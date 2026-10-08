import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture } from '../../engine/materials.js';
import { hotelEnv, roomShell, chandelier, hotelHalo, GOLD } from './kit.js';
import { trollCheckpoint, fakeExit, fakeComplete, evasiveGoal, twistZone, vanishAfter, adBreak } from './trolls.js';
import { shuffle, rint, wallZ, wallX, slideDoor, doorFrame, escapeStages, canvasPlane } from './escape-kit.js';

// Hotel level 8 — "Dinner Is Served" (Medium · Restaurant). An escape room that runs through the whole restaurant, five rooms, one checkpoint each:
//   1 The Dining Room  serve the six courses in the order the menu's riddles give (the host says "dessert first": he lies). A wrong
//                      course sends the dessert trolley down on you (its shadow grows first). The last course opens the kitchen (after a word from our sponsor).
//   2 The Pass         the cloche shell game: a key under one dome, seven swaps, and the host points at the wrong one (he always does). Pick the right dome.
//   3 The Pantry       the tip jar: exact change, coins on the shelves, the amount is on the note (the host says twenty). The dumbwaiter is a fake exit.
//   4 The Wine Cellar  barrels roll down the aisle, the Merlot is slippery, input lag in the middle, and a checkpoint that expires. The ring at the end is a
//                      fake LEVEL COMPLETE ("you forgot dessert: second sitting").
//   5 Dessert Parlour  climb the cake over a pit of cream: a cookie that crumbles, a tray that slides, a meringue bridge that gives way, a cherry that hops
// Baby Mode: the shuffle is slower and shorter, the lag is brief, the decoy door is labelled, the expiring checkpoint keeps, the cherry hops once.

const H = 15;
const WALL_Z = -17;            // the wall between the dining room and the kitchen
const WB = -36.4, WC = -60.4, WD = -105.4;   // the walls between the pass, the pantry, the cellar and the dessert parlour
const NAMES = ['The Dining Room', 'The Pass', 'The Pantry', 'The Wine Cellar', 'Dessert Parlour'];
const COURSES = [
  { name: 'Soup', clue: 'Hot, wet, and the favourite of spoons', col: 0xe8923a, shape: 'bowl' },
  { name: 'Fish', clue: 'It swims. It smells of regret', col: 0x9fb2c4, shape: 'fish' },
  { name: 'Steak', clue: 'It used to say moo', col: 0x8a4a30, shape: 'slab' },
  { name: 'Salad', clue: 'What a rabbit orders', col: 0x4fae5a, shape: 'leaf' },
  { name: 'Cheese', clue: 'Smells. On purpose', col: 0xf0cf5a, shape: 'wedge' },
  { name: 'Dessert', clue: 'Always last. Children disagree', col: 0xf08ab4, shape: 'cake' },
];
const brass = () => plainMaterial(GOLD, { metalness: 1, roughness: 0.25 });

function dish(shape, col) {
  const g = new THREE.Group();
  const m = plainMaterial(col, { roughness: 0.55 });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.05, 20), plainMaterial(0xf4f0e8, { roughness: 0.3 })); plate.position.y = 0.025; g.add(plate);
  let top;
  if (shape === 'bowl') { top = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); top.position.y = 0.06; }
  else if (shape === 'fish') { top = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), m); top.scale.set(1.5, 0.45, 0.7); top.position.y = 0.2; }
  else if (shape === 'slab') { top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.38), m); top.position.y = 0.12; }
  else if (shape === 'leaf') { top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), m); top.position.y = 0.26; top.scale.set(1, 0.7, 1); }
  else if (shape === 'wedge') { top = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 3), m); top.position.y = 0.15; }
  else { top = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.4, 12), m); top.position.y = 0.25; const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), plainMaterial(0xd01030, { roughness: 0.3 })); cherry.position.y = 0.5; g.add(cherry); }
  g.add(top);
  return g;
}

export default {
  id: 'hotel-8',
  name: 'Dinner Is Served',
  music: 'hotel_ballroom',
  completeQuip: 'You ate nothing, served everything and were insulted twice. A five-star review.',

  build(w, game) {
    hotelEnv(w);
    w.spawn = { x: 0, y: 0, z: 11, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -8;
    const zEnd = -168;
    const hall = roomShell(w, { x0: -12, x1: 12, z0: zEnd, z1: 15, yb: -10, H, wallTex: 'damask', wallColor: 0xffffff, pilasterEvery: 12 });
    w.plat({ x: 0, y: -9.5, z: hall.cz, w: 24, d: hall.D, h: 1, tex: 'carpet', color: 0x2a0c14, roughness: 0.95 });

    // ---- the dining room --------------------------------------------------------------------------------------
    w.plat({ x: 0, y: 0, z: (15 + WALL_Z - 0.8) / 2, w: 24, d: 15 - (WALL_Z - 0.8), h: 2, tex: 'carpet', color: 0xb83a4a, roughness: 0.95, trim: GOLD });
    chandelier(w, 0, 10.4, 4, 0.85); chandelier(w, 0, 10.4, -8, 0.85);
    // the partition wall with the kitchen door (a sliding panel; the last course opens it)
    const D_W = 4.4, D_H = 4.6;
    wallZ(w, { z: WALL_Z - 0.4, x0: -12.8, x1: 12.8, y0: -2, y1: H + 10, gaps: [{ c: 0, w: D_W, h: D_H }], mat: { tex: 'damask', color: 0xffffff, roughness: 0.7 } });
    const door = slideDoor(w, game, { x: 0, z: WALL_Z - 0.4, width: D_W, height: D_H, tex: 'wood', color: 0x6a4a2a, speed: 0.55 });
    doorFrame(w, { x: 0, z: WALL_Z - 0.4, width: D_W, height: D_H });
    w.sign({ text: 'KITCHEN · DELIVERIES', x: 0, y: D_H + 1.0, z: WALL_Z + 0.06, w: 6, h: 0.9, color: '#f1d28a', double: false, tw: 1024, size: 60 });
    // the long table (you can hop on it; the cloches are in the way)
    const TZ = -4;
    w.plat({ x: 0, y: 1.05, z: TZ, w: 10, d: 2.4, h: 0.16, tex: 'wood', color: 0xe8d8b8, roughness: 0.4, radius: 0.04 });
    w.plat({ x: 0, y: 0.5, z: TZ, w: 9.4, d: 2.0, h: 1.0, tex: 'wood', color: 0xffffff, roughness: 0.5, radius: 0.04 });
    w.box({ x: 0, y: 1.14, z: TZ, w: 10.1, h: 0.04, d: 0.9, color: 0xf4ecd8, rough: 0.7, shadow: false });
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
      w.box({ x: -3.9 + i * 2.6, y: 0.5, z: TZ + sx * 2.0, w: 0.8, h: 1.0, d: 0.8, color: 0x6a1a26, rough: 0.6, shadow: false });
      w.box({ x: -3.9 + i * 2.6, y: 1.1, z: TZ + sx * 2.35, w: 0.8, h: 0.9, d: 0.1, color: 0x6a1a26, rough: 0.6, shadow: false });
    }
    // candles
    for (const x of [-4.6, 0, 4.6]) { w.box({ x, y: 1.5, z: TZ - 0.8, w: 0.06, h: 0.5, d: 0.06, color: 0xf0e8d0, rough: 0.5, shadow: false }); w.box({ x, y: 1.82, z: TZ - 0.8, w: 0.08, h: 0.1, d: 0.08, glow: 0xffc060, glowIntensity: 2.4, shadow: false }); hotelHalo(w, x, 1.85, TZ - 0.8, 1.6, 0xffc070, 0.4); }
    // the guest at the head of the table: a mannequin in a napkin, waiting
    const guestX = 6.2, guestZ = TZ;
    const guest = new THREE.Group(); guest.position.set(guestX, 0, guestZ);
    const suit = plainMaterial(0x14141c, { roughness: 0.5 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.1, 14), suit); torso.position.y = 1.35; guest.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), plainMaterial(0xe6c8a8, { roughness: 0.6 })); head.position.y = 2.1; guest.add(head);
    const napkin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.06), plainMaterial(0xffffff, { roughness: 0.8 })); napkin.position.set(0, 1.55, 0.45); guest.add(napkin);
    const stache = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.06), plainMaterial(0x201010)); stache.position.set(0, 2.05, 0.26); guest.add(stache);
    for (const sx of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), plainMaterial(0x111111)); eye.position.set(sx * 0.1, 2.15, 0.25); guest.add(eye); }
    guest.rotation.y = -Math.PI / 2; w.add(guest);
    w.box({ x: guestX + 0.9, y: 1.1, z: guestZ, w: 0.9, h: 2.2, d: 0.9, color: 0x6a1a26, rough: 0.6, shadow: false });
    const guestPlate = new THREE.Group(); guestPlate.position.set(guestX - 1.0, 1.15, guestZ); w.add(guestPlate);

    // ---- the menu on the wall (riddles, in the real order) ---------------------------------------------------------
    const order = shuffle(COURSES);
    const menu = document.createElement('canvas'); menu.width = 640; menu.height = 900;
    const mg = menu.getContext('2d');
    mg.fillStyle = '#f3e9d2'; mg.fillRect(0, 0, 640, 900);
    mg.strokeStyle = '#7a5a1c'; mg.lineWidth = 10; mg.strokeRect(14, 14, 612, 872);
    mg.fillStyle = '#7a1f2a'; mg.textAlign = 'center'; mg.font = '58px "Archivo Black", Impact, sans-serif'; mg.fillText('TONIGHT\'S MENU', 320, 100);
    mg.fillStyle = '#2a2430'; mg.font = '26px "Archivo Black", Impact, sans-serif'; mg.fillText('served strictly in this order', 320, 140);
    order.forEach((c, i) => {
      mg.fillStyle = '#7a5a1c'; mg.font = '36px "Archivo Black", Impact, sans-serif'; mg.textAlign = 'left'; mg.fillText(['I', 'II', 'III', 'IV', 'V', 'VI'][i], 48, 240 + i * 120);
      mg.fillStyle = '#2a2430'; mg.font = '28px "Archivo Black", Impact, sans-serif';
      const words = c.clue.split(' '); let line = '', y = 232 + i * 120, lines = [];
      for (const wd of words) { if (mg.measureText(line + wd).width > 480) { lines.push(line); line = ''; } line += wd + ' '; }
      lines.push(line);
      lines.forEach((l, k) => mg.fillText(l.trim(), 120, y + k * 34 - (lines.length - 1) * 14));
    });
    const menuTex = new THREE.CanvasTexture(menu); menuTex.colorSpace = THREE.SRGBColorSpace; menuTex.anisotropy = 8; w.ownTextures.push(menuTex);
    const menuMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.0), new THREE.MeshBasicMaterial({ map: menuTex, toneMapped: false })); menuMesh.position.set(-7.6, 3.6, WALL_Z + 0.1); w.add(menuMesh);
    w.box({ x: -7.6, y: 3.6, z: WALL_Z + 0.04, w: 3.9, h: 5.3, d: 0.06, color: GOLD, metal: 1, rough: 0.35, shadow: false });

    // ---- the six cloches --------------------------------------------------------------------------------------------
    const cloches = [], tableX = [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75];
    const dishOrder = shuffle(COURSES);           // which dish sits under which cloche (left to right)
    let served = 0, doorOpen = false, trapBusy = false, adDone = false;
    dishOrder.forEach((c, i) => {
      const grp = new THREE.Group(); grp.position.set(tableX[i], 1.15, TZ + 0.1); w.add(grp);
      grp.add(dish(c.shape, c.col));
      const dome = new THREE.Group(); grp.add(dome);
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass()); bell.position.y = 0.04; bell.castShadow = true; dome.add(bell);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), brass()); knob.position.y = 0.56; dome.add(knob);
      const tag = w.sign({ text: c.name.toUpperCase(), x: tableX[i], y: 1.18, z: TZ + 1.0, w: 1.0, h: 0.3, rotX: -Math.PI / 2, color: '#f1d28a', double: false, tw: 256, size: 44 });
      void tag;
      const rec = { c, grp, dome, up: 0, served: false, i };
      cloches.push(rec);
      w.interactable({
        x: tableX[i], y: 1.55, z: TZ + 0.1, w: 1.1, h: 0.9, d: 1.1, range: 4.2, pad: 0.05,
        label: () => (doorOpen ? `${c.name} (served)` : rec.served ? `${c.name} (served)` : `Serve the ${c.name.toLowerCase()}`),
        onUse: (g) => serve(g, rec),
      });
    });
    w.onUpdate((dt) => { for (const r of cloches) { r.dome.position.y += ((r.served ? 0.9 : 0) - r.dome.position.y) * Math.min(1, dt * 8); r.dome.rotation.y += (r.served ? dt * 3 : 0); } });

    // ---- the dessert trolley: a cake falls where you stand (a shadow tells you first) ----------------------------------
    const cake = new THREE.Group(); cake.visible = false; w.add(cake);
    const tier = (r, h, y, col) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), plainMaterial(col, { roughness: 0.5 })); m.position.y = y; m.castShadow = true; cake.add(m); };
    tier(1.4, 0.7, 0.35, 0xf6e4d0); tier(1.0, 0.6, 1.0, 0xf08ab4); tier(0.6, 0.5, 1.55, 0xfff4e8);
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), plainMaterial(0xd01030, { roughness: 0.3 })); cherry.position.y = 1.95; cake.add(cherry);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); shadow.rotation.x = -Math.PI / 2; shadow.visible = false; w.add(shadow);
    const hz = w.hazard({ x: 0, y: -20, z: 0, w: 2.6, h: 2.0, d: 2.6, color: 0xff3a46 });
    hz.core.visible = false; hz.shell.visible = false; hz.enabled = false;
    const trap = { t: -1, x: 0, z: 0 };
    const springTrap = (g) => {
      trapBusy = true; trap.t = 0; trap.x = g.player.x; trap.z = g.player.z; cake.visible = true; shadow.visible = true;
      shadow.position.set(trap.x, 0.04, trap.z); cake.position.set(trap.x, 11, trap.z);
      g.audio.whoosh();
    };
    w.onUpdate((dt) => {
      if (trap.t < 0) return;
      trap.t += dt;
      const FALL_AT = 0.9;
      if (trap.t < FALL_AT) { shadow.material.opacity = 0.15 + 0.4 * (trap.t / FALL_AT); shadow.scale.setScalar(0.4 + 0.6 * (trap.t / FALL_AT)); }
      else if (trap.t < FALL_AT + 0.25) { const u = (trap.t - FALL_AT) / 0.25; cake.position.y = 11 * (1 - u * u); hz.body.setCenter(trap.x, 0.95 + 11 * (1 - u * u), trap.z); hz.enabled = u > 0.45; }
      else if (trap.t < FALL_AT + 1.4) { cake.position.y = 0; hz.body.setCenter(trap.x, 0.95, trap.z); hz.enabled = trap.t < FALL_AT + 0.45; }
      else { cake.visible = false; shadow.visible = false; hz.enabled = false; hz.body.setCenter(0, -20, 0); trap.t = -1; trapBusy = false; }
    });

    // serving logic
    function serve(g, rec) {
      if (doorOpen || rec.served || trapBusy) return;
      g.audio.click();
      if (rec.c === order[served]) {
        rec.served = true; served++;
        guestPlate.clear(); guestPlate.add(dish(rec.c.shape, rec.c.col));
        g.audio.confirm();
        if (served === 1) g.say('hotel.l8.first', { priority: 1 });
        else if (served === 3) g.say('hotel.l8.half', { priority: 1 });
        if (served === order.length) {
          doorOpen = true; door.openDoor();
          w.after(0.5, () => g.say('hotel.l8.open', { priority: 2 }));
          w.after(2.4, () => { if (!adDone) { adDone = true; adBreak(g, w, { sec: 4, say: 'hotel.l8.ad', sayAfter: 'hotel.l8.ad2' }); } });   // a word from our sponsor (the game does not freeze; the way is clear)
        }
      } else {
        g.say(rec.c.name === 'Dessert' ? 'hotel.l8.dessert' : 'hotel.l8.wrong', { priority: 2 });
        served = 0; cloches.forEach((r) => { r.served = false; });
        guestPlate.clear();
        springTrap(g);
      }
    }

    // ---- shared bits for the rooms behind the kitchen door ------------------------------------------------------------
    const baby = () => game.baby;
    const path = (p) => { p.o.path = true; return p; };
    const STEEL = { tex: 'metal', color: 0xaab2bc, roughness: 0.4, metalness: 0.6 };
    // floors and walls: kitchen (tile) and pantry; the side walls are clad in tile so the ballroom pilasters do not show
    w.plat({ x: 0, y: 0, z: (WALL_Z - 0.8 + WB - 0.4) / 2, w: 24, d: (WALL_Z - 0.8) - (WB - 0.4), h: 2, tex: 'tile', color: 0xc9d1d8, roughness: 0.45 });
    w.plat({ x: 0, y: 0, z: (WB - 0.4 + WC + 0.4) / 2, w: 24, d: (WB - 0.4) - (WC + 0.4), h: 2, tex: 'tile', color: 0xb9a98a, roughness: 0.6 });
    for (const s of [-1, 1]) wallX(w, { x: s * 11.4, z0: WALL_Z - 0.8, z1: WC, y0: -2, y1: 12, d: 1.2, mat: { tex: 'tile', color: 0xeef0ee, roughness: 0.5 } });
    wallZ(w, { z: WB, x0: -12.8, x1: 12.8, y0: -2, y1: 12, d: 0.8, gaps: [{ c: 0, w: 3.2, h: 3.8 }], mat: { tex: 'tile', color: 0xeef0ee } });
    wallZ(w, { z: WC, x0: -12.8, x1: 12.8, y0: -2, y1: 12, d: 0.8, gaps: [{ c: 0, w: 3.4, h: 3.8 }], mat: { tex: 'stone', color: 0x9a8a72 } });
    w.light(0xfff4e0, 16, 26, 0, 6.5, -27); w.light(0xffe6c0, 14, 24, 0, 6.5, -45);
    for (const z of [-22, -30, -41, -49, -57]) for (const x of [-5, 5]) { w.box({ x, y: 7.0, z, w: 2.4, h: 0.1, d: 0.3, glow: 0xfff2d8, glowIntensity: 1.5, shadow: false }); hotelHalo(w, x, 6.7, z, 4, 0xffe8c0, 0.14); }
    // a tile band along the kitchen walls
    for (const s of [-1, 1]) w.box({ x: s * 10.78, y: 1.6, z: (WALL_Z + WC) / 2, w: 0.06, h: 0.16, d: WALL_Z - WC, color: 0x2a6a7a, shadow: false });
    const stove = (x, z) => {
      w.plat({ x, y: 1.0, z, w: 2.6, d: 1.4, h: 1.0, ...STEEL, radius: 0.04 });
      for (const [bx, bz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.35], [0.6, 0.35]]) w.box({ x: x + bx, y: 1.03, z: z + bz, w: 0.6, h: 0.04, d: 0.6, glow: 0xff5a2a, glowIntensity: 1.1, shadow: false });
      w.box({ x, y: 4.2, z: z - 0.55, w: 2.2, h: 0.1, d: 0.1, color: 0x30343c, metal: 0.6, shadow: false });
      for (const k of [-0.8, -0.2, 0.5]) { w.box({ x: x + k, y: 3.7, z: z - 0.55, w: 0.03, h: 1.0, d: 0.03, color: 0x30343c, shadow: false }); const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.26, 12), plainMaterial(0x5a5e68, { metalness: 0.8, roughness: 0.3 })); pot.position.set(x + k, 3.1, z - 0.55); w.add(pot); }
    };
    const cpPass = w.checkpoint({ x: 0, y: 0, z: -19.8, real: true });
    const cpPantry = w.checkpoint({ x: 0, y: 0, z: -38.8, real: true });
    stove(-8.2, -20.4); stove(8.2, -20.4); stove(-8.2, -33.4); stove(8.2, -33.4);

    // ============================================================================================================
    //  Stage 2 · the pass: the cloche shell game
    // ============================================================================================================
    const PZ = -26.5, TOPY = 1.12, SLOT_X = [-3, 0, 3], WHERE = ['left', 'middle', 'right'];
    w.plat({ x: 0, y: 1.0, z: PZ, w: 14, d: 1.9, h: 1.0, ...STEEL, radius: 0.05 });
    w.plat({ x: 0, y: 1.08, z: PZ, w: 14.3, d: 2.1, h: 0.08, tex: 'metal', color: 0xd6dce4, roughness: 0.25, metalness: 0.8, radius: 0.03 });
    for (const x of [-6.8, 6.8]) w.box({ x, y: 2.6, z: PZ - 0.9, w: 0.1, h: 3.1, d: 0.1, color: 0x30343c, metal: 0.6, shadow: false });
    w.box({ x: 0, y: 4.1, z: PZ - 0.9, w: 14, h: 0.14, d: 0.14, color: 0xff7a2a, glow: 0xff7a2a, glowIntensity: 0.9, shadow: false });   // the heat lamp rail
    w.sign({ text: 'THE PASS · ORDERS UP', x: 0, y: 3.5, z: PZ - 0.93, w: 6, h: 0.7, color: '#f1d28a', double: false, tw: 1024, size: 60, rotY: Math.PI });
    w.sign({ text: 'THE PASS · ORDERS UP', x: 0, y: 3.5, z: PZ + 0.93, w: 6, h: 0.7, color: '#f1d28a', double: false, tw: 1024, size: 60 });
    const sh = { phase: 'idle', t: 0, kd: rint(0, 2), occ: [0, 1, 2], swaps: [], k: 0, got: false, lie: 0, wrongs: 0, round: 0 };
    const domes = SLOT_X.map((sx, i) => {
      const grp = new THREE.Group(); grp.position.set(sx, TOPY, PZ); w.add(grp);
      const lid = new THREE.Group(); grp.add(lid);
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass()); bell.position.y = 0.04; bell.castShadow = true; lid.add(bell);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), brass()); knob.position.y = 0.6; lid.add(knob);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.52, 0.05, 22), plainMaterial(0xf4f0e8, { roughness: 0.3 })); plate.position.y = 0.025; grp.add(plate);
      return { grp, lid, slot: i, target: 0 };
    });
    const keyMesh = new THREE.Group();
    { const gm = plainMaterial(0xffd23f, { metalness: 1, roughness: 0.25 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16), gm); ring.rotation.x = Math.PI / 2; ring.position.set(-0.2, 0.09, 0); keyMesh.add(ring);
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.04), gm); shaft.position.set(0.05, 0.09, 0); keyMesh.add(shaft);
      for (const dx of [0.14, 0.21]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.09), gm); t.position.set(dx, 0.09, 0.045); keyMesh.add(t); } }
    domes[sh.kd].grp.add(keyMesh); keyMesh.position.y = 0.05;
    const SW = () => ({ n: baby() ? 4 + sh.round * 2 : 7 + sh.round * 3, dur: baby() ? 0.85 : 0.55 });
    const startShuffle = () => {
      const { n } = SW(); sh.swaps = []; let prev = '';
      while (sh.swaps.length < n) { const a = rint(0, 2); let b = rint(0, 2); if (a === b) continue; const key = [a, b].sort().join(); if (key === prev) continue; prev = key; sh.swaps.push([a, b]); }
      sh.k = 0; sh.t = 0; sh.phase = 'shuffle';
    };
    const slotOfKey = () => domes[sh.kd].slot;
    w.onUpdate((dt) => {
      for (const d of domes) d.lid.position.y += (d.target - d.lid.position.y) * Math.min(1, dt * 9);
      if (sh.phase === 'show') { sh.t += dt; if (sh.t > 1.7) { domes[sh.kd].target = 0; sh.phase = 'lower'; sh.t = 0; } }
      else if (sh.phase === 'lower') { sh.t += dt; if (sh.t > 0.6) startShuffle(); }
      else if (sh.phase === 'shuffle') {
        const { dur } = SW(); const [a, b] = sh.swaps[sh.k];
        const da = domes.find((d) => d.slot === a), db = domes.find((d) => d.slot === b);
        sh.t += dt; const u = Math.min(1, sh.t / dur), e = u * u * (3 - 2 * u);
        da.grp.position.set(SLOT_X[a] + (SLOT_X[b] - SLOT_X[a]) * e, TOPY, PZ + 0.75 * Math.sin(Math.PI * e));
        db.grp.position.set(SLOT_X[b] + (SLOT_X[a] - SLOT_X[b]) * e, TOPY, PZ - 0.75 * Math.sin(Math.PI * e));
        if (u >= 1) {
          da.slot = b; db.slot = a; da.grp.position.set(SLOT_X[b], TOPY, PZ); db.grp.position.set(SLOT_X[a], TOPY, PZ);
          sh.k++; sh.t = 0;
          if (sh.k >= sh.swaps.length) {
            sh.phase = 'pick';
            const wrong = [0, 1, 2].filter((s) => s !== slotOfKey()); sh.lie = wrong[rint(0, 1)];
            game.say('hotel.l8.p.point', { priority: 2, vars: { where: WHERE[sh.lie] } });                                  // the host is very sure. He is pointing at the wrong dome.
          }
        }
      } else if (sh.phase === 'wrong') { sh.t += dt; if (sh.t > 1.5) { for (const d of domes) d.target = 0; sh.phase = 'idle'; } }
    });
    const ringBell = (g) => {
      if (sh.phase !== 'idle' || sh.got) return;
      g.audio.click(); domes[sh.kd].target = 0.95; sh.phase = 'show'; sh.t = 0;
      g.say('hotel.l8.p.start', { priority: 2 });
    };
    const pickSlot = (g, s) => {
      if (sh.phase !== 'pick') return;
      const d = domes.find((q) => q.slot === s); d.target = 0.95; g.audio.click();
      if (d === domes[sh.kd]) {
        sh.round++;
        if (sh.round < 3) {                                                                          // double or nothing, and again: the chef wants it three times
          g.audio.confirm(); g.ui.toast('One more round. The chef is thorough.', 'gold'); g.say('hotel.l8.p.again', { priority: 2 });
          w.after(1.6, () => { for (const q of domes) q.target = 0; domes[sh.kd].grp.remove(keyMesh); sh.kd = rint(0, 2); domes[sh.kd].grp.add(keyMesh); keyMesh.position.y = 0.05; sh.phase = 'idle'; });
          sh.phase = 'between'; return;
        }
        sh.got = true; sh.phase = 'done'; g.audio.confirm(); keyMesh.visible = false;
        g.ui.toast('🔑 You have the pantry key', 'gold'); g.say('hotel.l8.p.key', { priority: 2 });
      } else { sh.phase = 'wrong'; sh.t = 0; sh.wrongs++; g.audio.buzzer(); g.say('hotel.l8.p.wrong', { priority: 2, vars: { where: WHERE[s] } }); }
    };
    w.interactable({ x: 5.9, y: 1.5, z: PZ, w: 1.2, h: 1.0, d: 1.4, range: 3.4, label: () => (sh.got ? 'The chef\'s bell' : sh.phase === 'idle' ? 'Ring the chef\'s bell (shell game)' : 'The chef\'s bell'), enabled: () => sh.phase === 'idle' && !sh.got, onUse: ringBell });
    w.box({ x: 5.9, y: 1.2, z: PZ, w: 0.5, h: 0.12, d: 0.5, color: 0x30343c, metal: 0.6, shadow: false });
    { const bell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass()); bell.position.set(5.9, 1.26, PZ); w.add(bell); }
    SLOT_X.forEach((sx, s) => w.interactable({ x: sx, y: 1.7, z: PZ, w: 1.5, h: 1.0, d: 1.6, range: 3.6, pad: 0.05, label: 'Lift this dome', enabled: () => sh.phase === 'pick', onUse: (g) => pickSlot(g, s) }));
    // the pantry door: locked until you have the key
    const doorB = slideDoor(w, game, { x: 0, z: WB, width: 3.2, height: 3.8, stripes: 0x30343c, speed: 0.4 });
    doorFrame(w, { x: 0, z: WB, width: 3.2, height: 3.8 });
    w.sign({ text: 'PANTRY · KEYHOLDERS ONLY', x: 0, y: 4.75, z: WB + 0.44, w: 5, h: 0.7, color: '#f1d28a', double: false, tw: 1024, size: 54 });
    w.interactable({ x: 0, y: 1.6, z: WB + 1.0, w: 3.2, h: 3, d: 1.6, range: 4, label: () => (sh.got ? 'Unlock the pantry' : 'Locked (the key is under a dome)'), enabled: () => !doorB.open, onUse: (g) => { if (sh.got) { doorB.openDoor(); g.say('hotel.l8.p.door', { priority: 2 }); } else { g.audio.buzzer(); g.ui.toast('Locked. The key is under one of the domes.', 'bad'); } } });

    // ============================================================================================================
    //  Stage 3 · the pantry: exact change for the tip jar
    // ============================================================================================================
    let T; do { T = rint(27, 29); } while (T === 20);
    const coinDefs = [
      { v: 10, x: -9.8, y: 1.85, z: -41 }, { v: 5, x: 9.8, y: 1.85, z: -40 }, { v: 5, x: -9.8, y: 0.95, z: -47.5 }, { v: 7, x: 9.8, y: 2.75, z: -52 },
      { v: 2, x: -9.8, y: 2.75, z: -53 }, { v: 1, x: 9.8, y: 0.95, z: -57 }, { v: 3, x: -9.8, y: 1.85, z: -58 },
    ];


    // shelves along the walls (the dumbwaiter hatch sits in the east gap)
    const shelf = (x, z0, z1) => {
      const len = Math.abs(z1 - z0), zc = (z0 + z1) / 2;
      for (const y of [0.9, 1.8, 2.7]) w.box({ x, y: y - 0.04, z: zc, w: 1.4, h: 0.08, d: len, tex: 'wood', color: 0x7a5a38, shadow: false });
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1) + 0.01; z += len / 3) w.box({ x, y: 1.5, z, w: 1.4, h: 3.0, d: 0.1, tex: 'wood', color: 0x5a3a1a, shadow: false });
      w.collider({ x, y: 1.5, z: zc, w: 1.4, h: 3.0, d: len });
      for (let k = 0; k < Math.round(len / 1.0); k++) for (const y of [0.9, 1.8, 2.7]) { if ((k * 7 + Math.round(y * 3)) % 3 === 0) continue; const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.36, 10), plainMaterial([0xb04a2a, 0x4a7a3a, 0xc9a44a, 0x8a4a6a][(k + Math.round(y * 2)) % 4], { roughness: 0.4 })); jar.position.set(x + (k % 2 ? 0.2 : -0.25), y + 0.18, Math.min(z0, z1) + 0.5 + k * 1.0); w.add(jar); }
    };
    shelf(-10.0, -38.4, -58.4); shelf(10.0, -38.4, -43.6); shelf(10.0, -48.4, -58.4);
    // the coins
    const pocket = [];
    let jarDone = false;
    const coins = coinDefs.map((c) => {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 18), plainMaterial(0xe8c24a, { metalness: 1, roughness: 0.25 }));
      disc.position.set(c.x, c.y + 0.03, c.z); w.add(disc);
      const face = canvasPlane(w, { x: c.x, y: c.y + 0.056, z: c.z, width: 0.34, height: 0.34, rotX: -Math.PI / 2, px: 128, transparent: true, draw: (g, cw, ch) => { g.clearRect(0, 0, cw, ch); g.fillStyle = '#5a3a08'; g.font = '700 84px "Archivo Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(c.v), cw / 2, ch / 2 + 4); } });
      const rec = { ...c, taken: false, disc, face };
      rec.it = w.interactable({ x: c.x, y: c.y + 0.1, z: c.z, w: 0.8, h: 0.6, d: 0.8, range: 3.8, pad: 0.02, label: () => `Take the ${c.v}¢ coin`, enabled: () => !rec.taken && !jarDone, onUse: (g) => takeCoin(g, rec) });
      return rec;
    });
    const pocketSum = () => pocket.reduce((a, c) => a + c.v, 0);
    const takeCoin = (g, c) => {
      if (c.taken || jarDone) return;
      c.taken = true; c.disc.visible = false; c.face.visible = false; pocket.push(c); g.audio.click();
      g.ui.toast(`Pocket: ${pocket.map((q) => q.v).join(' + ')} = ${pocketSum()}¢`, 'gold');
      if (pocket.length === 1) g.say('hotel.l8.t.coin', { priority: 1 });
    };
    const restock = () => { pocket.length = 0; for (const c of coins) { c.taken = false; c.disc.visible = true; c.face.visible = true; } };
    // the jar, on a table by the cellar door, and the note on the wall (the host says twenty; the note says what the jar wants)
    w.plat({ x: 0, y: 1.0, z: -58.6, w: 2.6, d: 1.4, h: 1.0, tex: 'wood', color: 0x8c6a3e, roughness: 0.55, radius: 0.04 });
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.8, 18), new THREE.MeshStandardMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 })); jar.position.set(0, 1.45, -58.6); w.add(jar);
    const jarRim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 18), brass()); jarRim.position.set(0, 1.9, -58.6); w.add(jarRim);
    w.sign({ text: 'TIPS', x: 0, y: 1.45, z: -58.23, w: 0.5, h: 0.24, color: '#ffd21f', double: false, tw: 256, size: 90 });
    canvasPlane(w, { x: -3.6, y: 2.2, z: WC + 0.5, width: 1.8, height: 1.3, px: 512, draw: (g, cw, ch) => {
      g.fillStyle = '#f6efd8'; g.fillRect(0, 0, cw, ch); g.strokeStyle = '#7a1f2a'; g.lineWidth = 8; g.strokeRect(10, 10, cw - 20, ch - 20);
      g.fillStyle = '#7a1f2a'; g.textAlign = 'center'; g.font = '46px "Archivo Black", Impact, sans-serif'; g.fillText('STAFF NOTICE', cw / 2, 70);
      g.fillStyle = '#1a1a22'; g.font = '34px "Archivo Black", Impact, sans-serif'; g.fillText('THE JAR WANTS EXACTLY', cw / 2, 130);
      g.font = '110px "Archivo Black", Impact, sans-serif'; g.fillText(`${T}¢`, cw / 2, 245);
      g.font = '26px "Archivo Black", Impact, sans-serif'; g.fillStyle = '#7a5a1c'; g.fillText('no more. no less. it counts.', cw / 2, 300);
    } });
    w.box({ x: -3.6, y: 2.2, z: WC + 0.45, w: 2.0, h: 1.5, d: 0.06, color: GOLD, metal: 1, rough: 0.35, shadow: false });
    const doorC = slideDoor(w, game, { x: 0, z: WC, width: 3.4, height: 3.8, tex: 'wood', color: 0x5a3a22, speed: 0.4 });
    doorFrame(w, { x: 0, z: WC, width: 3.4, height: 3.8 });
    w.sign({ text: 'WINE CELLAR · STAFF', x: 0, y: 4.75, z: WC + 0.44, w: 5, h: 0.7, color: '#f1d28a', double: false, tw: 1024, size: 54 });
    const putIn = (g) => {
      if (jarDone) return;
      const sum = pocketSum();
      if (!pocket.length) { g.audio.click(); g.say('hotel.l8.t.empty', { priority: 1 }); return; }
      if (sum === T) {
        jarDone = true; g.audio.confirm(); pocket.length = 0;
        g.ui.toast(`Exactly ${T}¢. The jar is moved.`, 'good'); g.say('hotel.l8.t.ok', { priority: 2 });
        w.after(0.8, () => doorC.openDoor());
      } else if (sum < T) { g.audio.buzzer(); g.ui.toast(`${sum}¢ is not enough. The jar is unimpressed.`, 'bad'); g.say('hotel.l8.t.short', { priority: 2 }); }
      else { g.audio.buzzer(); g.ui.toast(`${sum}¢ is too much. The jar keeps it. The shelves restock.`, 'bad'); g.say('hotel.l8.t.over', { priority: 2 }); restock(); }
    };
    w.interactable({ x: 0, y: 1.6, z: -58.1, w: 1.6, h: 1.4, d: 1.4, range: 3.6, label: () => (jarDone ? 'The tip jar (content)' : pocket.length ? `Put ${pocketSum()}¢ in the jar` : 'The tip jar (empty pocket)'), enabled: () => !jarDone, onUse: putIn });
    w.onRespawn(() => { if (!jarDone) restock(); });
    // the dumbwaiter: the host's idea of the quick way out (the staff hatch has no car)
    fakeExit(w, game, { x: 10.3, y: 0, z: -46, yaw: -Math.PI / 2, kind: 'door', label: 'DUMBWAITER · EXIT', color: 0x2dd47f, say: 'hotel.l8.t.dumb' });
    w.sign({ text: 'CAPACITY: 0 PASSENGERS', x: 10.5, y: 3.4, z: -46, w: 2.4, h: 0.35, rotY: -Math.PI / 2, color: '#2a3a4a', bg: '#e8f4ff', double: false, tw: 512, size: 36 });

    // ============================================================================================================
    //  Stage 4 · the wine cellar
    // ============================================================================================================
    const cz = (a, b) => (a + b) / 2, cd = (a, b) => Math.abs(a - b);
    const E = path(w.plat({ x: 0, y: 0, z: cz(WC - 0.4, -67), w: 9, d: cd(WC - 0.4, -67), h: 1.4, tex: 'wood', color: 0xc9a56e, roughness: 0.6, radius: 0.04 }));
    const A = path(w.plat({ x: 0, y: 0, z: cz(-67, -81), w: 9, d: 14, h: 1.4, tex: 'wood', color: 0xc9a56e, roughness: 0.6, radius: 0.04 }));
    const Mer = path(w.plat({ x: 0, y: 0, z: cz(-81, -89), w: 9, d: 8, h: 1.4, tex: 'wood', color: 0x7a1a2a, roughness: 0.2, radius: 0.04, slippery: 0.8 }));   // spilled Merlot
    const F = path(w.plat({ x: 0, y: 0, z: cz(-89, -105), w: 9, d: 16, h: 1.4, tex: 'wood', color: 0xc9a56e, roughness: 0.6, radius: 0.04 }));
    void E; void A; void Mer; void F;
    w.sign({ text: 'MIND THE MERLOT', x: 0, y: 0.03, z: -81.6, w: 5.5, h: 0.8, rotX: -Math.PI / 2, color: '#ffd21f', double: false, tw: 512, size: 58 });
    const cpCellar = trollCheckpoint(w, game, { x: 0, y: 0, z: -62.6, mode: 'expire', ttl: 22, say: 'hotel.l8.expired' });   // this one forgets itself: die after it has and you are back at the pantry door
    for (let z = -64; z > -104; z -= 5) for (const sx of [-1, 1]) {
      w.box({ x: sx * 10.8, y: 2.2, z, w: 2.4, h: 4.4, d: 3.6, color: 0x5a3a22, rough: 0.7, shadow: false });
      for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.7, 10), plainMaterial(0x214a2a, { roughness: 0.3, metalness: 0.2 })); b.rotation.z = Math.PI / 2; b.position.set(sx * 9.7, 0.7 + j * 1.0, z - 1.2 + k * 1.2); w.add(b); }
    }
    for (let z = -64; z > -104; z -= 11) w.light(0xffa860, 14, 22, 0, 4.4, z - 2);
    for (let z = -64; z > -104; z += -9) for (const sx of [-1, 1]) { w.box({ x: sx * 4.9, y: 3.4, z, w: 0.2, h: 0.4, d: 0.2, glow: 0xffb050, glowIntensity: 1.8, shadow: false }); hotelHalo(w, sx * 4.8, 3.4, z, 2.4, 0xffa050, 0.3); }
    // rolling barrels (three lanes)
    const barrels = [];
    const V = 2.8;
    // two barrel runs, with the Merlot (and a breather) between them
    const FIELDS = [{ z0: -81, L: 15, offs: [[-3.8, 0], [0, 5], [3.8, 10]] }, { z0: -97, L: 8, offs: [[-3.8, 0], [0, 2.7], [3.8, 5.3]] }];
    FIELDS.forEach((fd) => fd.offs.forEach(([lx, off]) => {
      const BZ0 = fd.z0, BL = fd.L;
      const bz = (t) => BZ0 + ((V * t + off) % BL);
      const hzb = w.hazard({ x: lx, y: 0.4, z: BZ0, w: 1.4, h: 0.7, d: 1.4, color: 0xff3a46, move: (t) => ({ z: bz(t) - BZ0 }) });
      hzb.core.visible = false; hzb.shell.visible = false; hzb.jumpable = true;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.3, 16), plainMaterial(0x7a4a26, { roughness: 0.55 })); barrel.rotation.z = Math.PI / 2; barrel.castShadow = true;
      const band = (yy) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.04, 6, 20), brass()); r.rotation.y = Math.PI / 2; r.position.x = yy; barrel.add(r); };
      band(-0.4); band(0.4);
      const spin = new THREE.Group(); spin.add(barrel); hzb.group.add(spin);
      w.onUpdate((dt, t) => { spin.rotation.x = -bz(t) / 0.62; });
      barrels.push(hzb);
    }));
    for (const fd of FIELDS) {   // the hatches the barrels roll out of
      w.box({ x: 0, y: 3.1, z: fd.z0 - 0.5, w: 9.6, h: 0.7, d: 0.8, color: 0x3a2a1a, rough: 0.7 });
      for (const sx of [-1, 1]) w.box({ x: sx * 4.7, y: 1.5, z: fd.z0 - 0.5, w: 0.5, h: 3.0, d: 0.8, color: 0x3a2a1a, rough: 0.7 });
      w.sign({ text: 'BARREL CHUTE', x: 0, y: 3.1, z: fd.z0 - 0.08, w: 4, h: 0.5, rotY: 0, color: '#ffd21f', double: false, tw: 512, size: 60 });
    }
    twistZone(game, w, { x: 0, y: 2, z: -75, w: 9, h: 4, d: 2.4 }, 'swap', { sec: 6, say: 'hotel.l8.swap' });      // A and D swap in the middle of the aisle (the toast says so)
    // the ring at the end of the aisle: it is the end of the level. Then it is not.
    const cellarGoal = w.goal({ x: 0, y: 0, z: -102.0, color: GOLD, onReach: () => {
      if (!fakeComplete(game, w, { title: 'LEVEL COMPLETE', jk: '…SECOND SITTING', say: 'hotel.l8.fakewin', sayAfter: 'hotel.l8.second', then: () => { doorD.openDoor(); } })) game.completeLevel();
    } });
    w.onUpdate(() => { if (doorD.open && cellarGoal.group.visible) { cellarGoal.group.visible = false; cellarGoal.trig.enabled = false; } });
    const doorD = slideDoor(w, game, { x: 0, z: WD, width: 4, height: 4.2, tex: 'wood', color: 0xe8c8d8 });
    doorFrame(w, { x: 0, z: WD, width: 4, height: 4.2 });
    w.sign({ text: 'KITCHEN · DELIVERIES', x: 0, y: 5.2, z: WD + 0.44, w: 8, h: 1.0, color: '#f1d28a', double: false, tw: 1024, size: 80 });
    wallZ(w, { z: WD, x0: -12.8, x1: 12.8, y0: -2, y1: 14, d: 0.8, gaps: [{ c: 0, w: 4, h: 4.2 }], mat: { tex: 'damask', color: 0xffffff } });

    // ============================================================================================================
    //  Stage 5 · the dessert parlour: up the cake, over the cream
    // ============================================================================================================
    const cpDessert = w.checkpoint({ x: 0, y: 0, z: -108.4, real: true });
    path(w.plat({ x: 0, y: 0, z: -109.6, w: 12, d: 7.2, h: 2, tex: 'marble', color: 0xf6e6d0, roughness: 0.3, radius: 0.05, trim: GOLD }));
    const cream = w.hazard({ x: 0, y: -1.05, z: -137, w: 24, h: 1.0, d: 64, color: 0xffffff });
    cream.core.visible = false; cream.shell.visible = false;
    { const pool = new THREE.Mesh(new THREE.PlaneGeometry(23.4, 62), new THREE.MeshStandardMaterial({ color: 0xfff4e6, roughness: 0.25, emissive: 0x6a5a4a, emissiveIntensity: 0.5 }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(0, -0.58, -137); w.add(pool);
      for (let k = 0; k < 18; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.5 + (k % 4) * 0.25, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x4a4038, emissiveIntensity: 0.4 })); d.scale.y = 0.55; d.position.set(-10 + (k * 7.3) % 20, -0.5, -108 - (k * 5.1) % 44); w.add(d); } }
    const frosting = [0xf0a8c8, 0xfff0d8, 0xd8a878, 0xc8e8d8];
    const cakeStep = (x, z, top, ww, dd, i, o = {}) => {
      const p = path(w.plat({ x, y: top, z, w: ww, d: dd, h: 0.5, tex: 'marble', color: frosting[i % 4], roughness: 0.35, radius: 0.12, ...o }));
      w.box({ x, y: (top - 1.5) / 2, z, w: Math.max(0.8, ww - 0.9), h: top + 0.5, d: Math.max(0.8, dd - 0.9), color: frosting[(i + 1) % 4], rough: 0.5, shadow: false });
      for (let k = 0; k < 3; k++) w.box({ x: x - ww / 3 + k * ww / 3, y: top + 0.03, z: z + (k - 1) * 0.3, w: 0.18, h: 0.04, d: 0.05, color: [0xff4a6a, 0x4a8aff, 0xffd23f][k], shadow: false });   // sprinkles
      return p;
    };
    const D1 = cakeStep(-3.0, -115.0, 0.9, 2.8, 2.8, 0);
    const D2 = w.crumble(cakeStep(2.0, -118.4, 1.8, 2.6, 2.6, 2, { tex: 'wood', color: 0xc8955a }), { delay: 0.6, gone: 3 });          // a cookie
    const D3 = cakeStep(6.0, -122.4, 2.6, 2.6, 2.6, 3); w.mover(D3, (t) => ({ z: 1.5 * Math.sin(t * 1.0) }));                      // a tray on a trolley, rolling
    const D4 = cakeStep(1.8, -126.2, 3.4, 3.4, 3.0, 1);
    const cpMid = w.checkpoint({ x: 1.8, y: 3.4, z: -126.2, real: true });
    const D5 = vanishAfter(w, game, cakeStep(-5.0, -126.2, 3.4, 7.0, 2.2, 0), { axis: 'x', dir: -1, frac: 0.5, delay: 0.7, back: 3.4, say: 'hotel.l8.bridge' });   // a meringue bridge
    const D6 = cakeStep(-8.8, -130.2, 4.2, 2.8, 2.8, 3);
    const D7 = cakeStep(-4.4, -133.6, 5.0, 2.8, 2.8, 2);
    const D8 = w.crumble(cakeStep(0.2, -136.6, 5.8, 2.6, 2.6, 1, { tex: 'wood', color: 0xc8955a }), { delay: 0.6, gone: 3 });
    const D9 = cakeStep(3.4, -139.8, 6.6, 2.6, 2.6, 0);
    const D10 = cakeStep(0, -143.2, 7.4, 2.8, 2.8, 3); w.mover(D10, (t) => ({ x: 1.2 * Math.sin(t * 0.9) }));
    const D11 = cakeStep(-4.4, -146.6, 8.2, 2.6, 2.6, 2);
    const D12a = cakeStep(0, -150.2, 9.0, 2.6, 2.6, 0); w.mover(D12a, (t) => ({ x: 1.0 * Math.sin(t * 0.8) }));
    const D12b = w.crumble(cakeStep(4.2, -153.6, 9.8, 2.6, 2.6, 2, { tex: 'wood', color: 0xc8955a }), { delay: 0.6, gone: 3 });
    const D12c = cakeStep(0, -157.0, 10.6, 2.6, 2.6, 3);
    const D12 = cakeStep(0, -161.2, 11.4, 5.4, 3.4, 1);
    const topCherry = new THREE.Group(); { const c = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), plainMaterial(0xd01030, { roughness: 0.25 })); c.position.y = 0.2; topCherry.add(c); }
    topCherry.position.set(-2.2, 11.9, -162.6); w.add(topCherry);
    w.light(0xffd8e8, 16, 28, 0, 7, -120); w.light(0xffe0f0, 14, 24, 0, 9, -136); w.light(0xffe0f0, 14, 24, 0, 11, -148); w.light(0xffe0f0, 14, 24, 0, 12, -160);
    for (const z of [-112, -124, -136, -148, -160]) for (const x of [-6, 6]) { w.box({ x, y: 13.6, z, w: 0.5, h: 0.3, d: 0.5, glow: 0xffd0e8, glowIntensity: 1.5, shadow: false }); hotelHalo(w, x, 13.2, z, 4, 0xffc0e0, 0.16); }
    const runner = evasiveGoal(w, game, { spots: [{ x: 1.8, y: 11.4, z: -160.8 }, { x: -1.8, y: 11.4, z: -161.8 }, { x: 0.4, y: 11.4, z: -160.4 }], radius: 4.2, color: 0xff5a8a, say: ['hotel.l8.hop1', 'hotel.l8.hop2'], onReach: () => { game.say('hotel.l8.done', { priority: 2 }); game.completeLevel(); } });
    w.goalObj = runner;
    w.sign({ text: 'DESSERT PARLOUR · SECOND SITTING', x: 0, y: 6.2, z: WD - 0.45, w: 9, h: 1.0, rotY: Math.PI, color: '#ffc8e0', double: false, tw: 1024, size: 70 });

    // ============================================================================================================
    //  The host, the stages, the hint
    // ============================================================================================================
    const S = escapeStages(w, game, [
      { name: NAMES[0], at: { x: 0, y: 0, z: 11 }, clues: ['hotel.l8.hint1', 'hotel.l8.hint2', 'hotel.l8.hint3'], vars: () => ({ a: order[0].name, b: order[1].name, all: order.map((c) => c.name).join(', ') }), solved: () => doorOpen, trail: [{ x: 0, y: 0, z: -2 }, { x: 0, y: 0, z: -12 }] },
      { name: NAMES[1], at: { x: 0, y: 0, z: -19.8 }, clues: ['hotel.l8.p.hint1', 'hotel.l8.p.hint2', 'hotel.l8.p.hint3'], vars: () => ({ where: WHERE[slotOfKey()] }), solved: () => sh.got, trail: [{ x: 8.6, y: 0, z: -22 }, { x: 8.6, y: 0, z: -30 }, { x: 0, y: 0, z: -34.4 }] },
      { name: NAMES[2], at: { x: 0, y: 0, z: -38.6 }, clues: ['hotel.l8.t.hint1', 'hotel.l8.t.hint2', 'hotel.l8.t.hint3'], vars: () => ({ t: T }), solved: () => jarDone, trail: [{ x: 0, y: 0, z: -48 }, { x: 0, y: 0, z: -56 }] },
      { name: NAMES[3], at: { x: 0, y: 0, z: -62.6 }, trail: [{ x: 0, y: 0, z: -72 }, { x: 0, y: 0, z: -85 }, { x: 0, y: 0, z: -98 }, { x: 0, y: 0, z: -104 }] },
      { name: NAMES[4], at: { x: 0, y: 0, z: -108.4 }, trail: [D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12a, D12b, D12c, D12].map((p) => ({ x: p.body.x, y: p.top, z: p.body.z })), end: () => ({ x: runner.x, y: runner.y, z: runner.z }) },
    ]);
    const cps = new Map([[cpPass, 1], [cpPantry, 2], [cpCellar, 3], [cpDessert, 4]]);
    w.hooks.onCheckpoint = (c) => {
      const i = cps.get(c);
      if (i === undefined) return;
      S.enter(i);
      if (i === 1) game.say('hotel.l8.pass', { priority: 1 });
      if (i === 2) game.say('hotel.l8.pantry', { priority: 1 });
      if (i === 3) game.say('hotel.l8.cellar', { priority: 1 });
      if (i === 4) game.say('hotel.l8.parlour', { priority: 1 });
    };
    let t0 = 0, intro = false, merlot = false;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      const p = g.player;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l8.intro'); g.say('hotel.l8.intro2', { vars: { first: 'dessert' } }); S.banner(); }
      if (!merlot && p.z < -80 && p.z > -89) { merlot = true; g.say('hotel.l8.merlot', { priority: 1 }); }
    };
    w.hooks.onDeath = (info) => {
      const p = game.player;
      if (info.reason === 'fake') return true;
      if (info.reason === 'hazard' && p.z < WD) { game.say('hotel.l8.cream', { priority: 2 }); return true; }
      if (info.reason === 'hazard' && p.z < WC) { game.say('hotel.l8.barrel', { priority: 2 }); return true; }
      if (info.reason === 'void' && p.z < WC) { game.say('hotel.l8.cream', { priority: 1 }); return true; }
      return false;
    };
    w.dinner = {
      order, cloches, get served() { return served; }, get doorOpen() { return doorOpen; }, barrels, hz, trap, get trapBusy() { return trapBusy; }, serve: (rec) => serve(game, rec),
      sh, domes, ringBell: () => ringBell(game), pickSlot: (s) => pickSlot(game, s), slotOfKey, doorB, doorC, doorD, T, coins, pocket, takeCoin: (c) => takeCoin(game, c), putIn: () => putIn(game),
      get jarDone() { return jarDone; }, stages: S, runner, cellarGoal, D5, cream, doorBuse: () => { doorB.openDoor(); },
    };
    // ---- the test bot -------------------------------------------------------------------------------------------------------
    const goTo = (x, z, tol = 0.7) => { const p = game.player; return Math.hypot(p.x - x, p.z - z) > tol ? { x, z } : null; };
    const subset = (() => { const vs = coinDefs.map((c) => c.v); for (let m = 1; m < 128; m++) { let s = 0; for (let i = 0; i < 7; i++) if (m & (1 << i)) s += vs[i]; if (s === T) return coinDefs.filter((_, i) => m & (1 << i)); } return []; })();
    let coinK = 0, coinT = 0, jarT = 0;
    w.botPlan = (g) => {
      const p = g.player;
      if (g.frozen || trapBusy) return { wait: true, x: p.x, z: p.z - 1 };
      // ---- 1 · the dining room
      if (!doorOpen) {
        const rec = cloches.find((r) => r.c === order[served]);
        const tx = tableX[rec.i], tz = TZ + 2.4;
        if (Math.hypot(p.x - tx, p.z - tz) > 1.0) return { x: tx, z: tz };
        serve(g, rec);
        return { wait: true, x: p.x, z: p.z };
      }
      if (door.t < 1 && p.z > WALL_Z - 0.2) return p.z > WALL_Z + 3 ? { x: 0, z: WALL_Z + 2 } : { wait: true, x: p.x, z: p.z };
      if (p.z > WALL_Z + 0.4 && Math.abs(p.x) > 0.9) return { x: 0, z: WALL_Z + 2 };
      // ---- 2 · the pass
      if (!sh.got) {
        if (sh.phase === 'idle') { const m = goTo(5.4, PZ + 2.6, 0.8); if (m) return m; ringBell(g); return { wait: true, x: p.x, z: p.z }; }
        if (sh.phase !== 'pick') return { wait: true, x: p.x, z: p.z };
        const sx = SLOT_X[slotOfKey()], m = goTo(sx, PZ + 2.6, 0.7); if (m) return m;
        pickSlot(g, slotOfKey()); return { wait: true, x: p.x, z: p.z };
      }
      if (!doorB.open) {
        if (p.z > PZ - 1.6 && Math.abs(p.x) < 8.2) return { x: 9.2, z: Math.max(p.z, PZ + 0.5) };
        if (p.z > PZ - 2.2 && p.x > 8.2) return { x: 9.2, z: PZ - 3.4 };
        const m = goTo(0, WB + 2.4, 1.0); if (m) return m;
        doorB.openDoor(); return { wait: true, x: p.x, z: p.z };
      }
      if (doorB.t < 1 && p.z > WB) return { wait: true, x: 0, z: WB + 2.4 };
      if (p.z > WB + 0.5 && Math.abs(p.x) > 1.0) return { x: 0, z: WB + 2.2 };
      // ---- 3 · the pantry
      if (!jarDone) {
        if (p.z > WB - 1) return { x: 0, z: WB - 3 };
        if (coinK < subset.length) {
          const c = subset[coinK], rec = coins.find((q) => q.x === c.x && q.z === c.z && q.y === c.y);
          const sx = Math.sign(c.x) * 7.2, m = goTo(sx, c.z, 0.7); if (m) return m;
          if (coinT === 0) { takeCoin(g, rec); coinT = 0.3; } else { coinT = Math.max(0, coinT - 1 / 60); if (coinT === 0) coinK++; }
          return { wait: true, x: p.x, z: p.z };
        }
        const m = goTo(0, -56.2, 0.8); if (m) return m;
        if (jarT === 0) { putIn(g); jarT = 1; }
        return { wait: true, x: p.x, z: p.z };
      }
      if (doorC.t < 1 && p.z > WC) return { wait: true, x: 0, z: WC + 2.6 };
      if (p.z > WC + 0.5 && Math.abs(p.x) > 1.1) return { x: 0, z: WC + 2.4 };
      // ---- 4 · the cellar: run in the gap between the barrel lanes (the route platforms do the rest), then the ring that is not the end
      if (!doorD.open && p.y > -1 && ((p.z < -66 && p.z > -81.5) || (p.z < -88.5 && p.z > -97.5))) return { x: 1.9, z: p.z - 3 };
      if (!doorD.open && p.z < -97 && p.y > -1) return { x: cellarGoal.x, z: cellarGoal.z };
      // ---- 5 · the parlour: the route platforms, then the cherry that hops away
      if (p.y > 10.8 && p.z < -157) return { x: runner.x, z: runner.z };
      return null;
    };
  },
};
void softTexture; void glowMaterial;
