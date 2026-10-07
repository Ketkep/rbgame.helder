import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture } from '../../engine/materials.js';
import { hotelEnv, roomShell, chandelier, hotelHalo, GOLD } from './kit.js';

// Hotel level 8 — "Dinner Is Served" (Medium · Restaurant). An escape room in the formal dining room. The kitchen door
// opens when the six courses are served in the order the menu describes (in riddles). Serve the wrong one and the
// dessert trolley is... airborne. Then the wine cellar: barrels roll down the aisle, and somebody spilled the Merlot.

const H = 13;
const WALL_Z = -17;            // the wall between the dining room and the cellar
const COURSES = [
  { name: 'Soup', clue: 'Hot, wet, and the favourite of spoons', col: 0xe8923a, shape: 'bowl' },
  { name: 'Fish', clue: 'It swims. It smells of regret', col: 0x9fb2c4, shape: 'fish' },
  { name: 'Steak', clue: 'It used to say moo', col: 0x8a4a30, shape: 'slab' },
  { name: 'Salad', clue: 'What a rabbit orders', col: 0x4fae5a, shape: 'leaf' },
  { name: 'Cheese', clue: 'Smells. On purpose', col: 0xf0cf5a, shape: 'wedge' },
  { name: 'Dessert', clue: 'Always last. Children disagree', col: 0xf08ab4, shape: 'cake' },
];
const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
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
    const zEnd = -66;
    const hall = roomShell(w, { x0: -12, x1: 12, z0: zEnd, z1: 15, yb: -10, H, wallTex: 'damask', wallColor: 0xffffff, pilasterEvery: 12 });
    w.plat({ x: 0, y: -9.5, z: hall.cz, w: 24, d: hall.D, h: 1, tex: 'carpet', color: 0x2a0c14, roughness: 0.95 });

    // ---- the dining room --------------------------------------------------------------------------------------
    w.plat({ x: 0, y: 0, z: (15 + WALL_Z - 0.8) / 2, w: 24, d: 15 - (WALL_Z - 0.8), h: 2, tex: 'carpet', color: 0xb83a4a, roughness: 0.95, trim: GOLD });
    chandelier(w, 0, 10.4, 4, 0.85); chandelier(w, 0, 10.4, -8, 0.85);
    // the partition wall with a doorway (the door is a sliding panel)
    const D_W = 4.4, D_H = 4.6;
    const wallSeg = (x, ww) => w.plat({ x, y: H, z: WALL_Z - 0.4, w: ww, d: 0.8, h: H + 10, tex: 'damask', color: 0xffffff, roughness: 0.7 });
    wallSeg(-(12 + D_W / 2) / 2, 12 - D_W / 2); wallSeg((12 + D_W / 2) / 2, 12 - D_W / 2);
    w.plat({ x: 0, y: H, z: WALL_Z - 0.4, w: D_W, d: 0.8, h: H - D_H, tex: 'damask', color: 0xffffff, roughness: 0.7 });
    const door = w.plat({ x: 0, y: D_H, z: WALL_Z - 0.4, w: D_W, d: 0.5, h: D_H, tex: 'wood', color: 0x6a4a2a, roughness: 0.5, radius: 0.03 });
    door.o.moving = true; door.group.matrixAutoUpdate = true;
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
    let served = 0, doorOpen = false, trapBusy = false;
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
          doorOpen = true; g.audio.door();
          w.after(0.5, () => g.say('hotel.l8.open', { priority: 2 }));
        }
      } else {
        g.say(rec.c.name === 'Dessert' ? 'hotel.l8.dessert' : 'hotel.l8.wrong', { priority: 2 });
        served = 0; cloches.forEach((r) => { r.served = false; });
        guestPlate.clear();
        springTrap(g);
      }
    }
    // the kitchen door slides up
    let doorT = 0;
    w.onUpdate((dt) => {
      if (!doorOpen || doorT >= 1) return;
      doorT = Math.min(1, doorT + dt * 0.8);
      door.setPos(0, D_H / 2 + doorT * (D_H + 0.3), WALL_Z - 0.4);
      if (doorT >= 1) door.setEnabled(false);
    });

    // ---- the wine cellar --------------------------------------------------------------------------------------------
    const path = (p) => { p.o.path = true; return p; };
    const E = path(w.plat({ x: 0, y: 0, z: (WALL_Z - 0.8 + -23) / 2, w: 9, d: Math.abs(WALL_Z - 0.8 + 23), h: 1.4, tex: 'wood', color: 0xc9a56e, roughness: 0.6, radius: 0.04 }));
    const A = path(w.plat({ x: 0, y: 0, z: (-23 + -35) / 2, w: 9, d: 12, h: 1.4, tex: 'wood', color: 0xc9a56e, roughness: 0.6, radius: 0.04 }));
    const S = path(w.plat({ x: 0, y: 0, z: (-35 + -43) / 2, w: 9, d: 8, h: 1.4, tex: 'wood', color: 0x7a1a2a, roughness: 0.2, radius: 0.04, slippery: 0.8 }));   // spilled Merlot
    const F = path(w.plat({ x: 0, y: 0, z: (-43 + -60) / 2, w: 9, d: 17, h: 1.4, tex: 'wood', color: 0xc9a56e, roughness: 0.6, radius: 0.04 }));
    void E; void A; void S; void F;
    w.sign({ text: 'MIND THE MERLOT', x: 0, y: 0.03, z: -33.4, w: 5.5, h: 0.8, rotX: -Math.PI / 2, color: '#ffd21f', double: false, tw: 512, size: 58 });
    w.checkpoint({ x: 0, y: 0, z: -41.5, real: true });
    // wine racks and barrels along the walls
    for (let z = -20; z > -62; z -= 5) for (const sx of [-1, 1]) {
      w.box({ x: sx * 10.8, y: 2.2, z, w: 2.4, h: 4.4, d: 3.6, color: 0x5a3a22, rough: 0.7, shadow: false });
      for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.7, 10), plainMaterial(0x214a2a, { roughness: 0.3, metalness: 0.2 })); b.rotation.z = Math.PI / 2; b.position.set(sx * 9.7, 0.7 + j * 1.0, z - 1.2 + k * 1.2); w.add(b); }
    }
    for (let z = -61; z < -17; z += 11) w.light(0xffa860, 14, 22, 0, 4.4, z - 2);
    for (let z = -22; z > -62; z += -9) for (const sx of [-1, 1]) { w.box({ x: sx * 4.9, y: 3.4, z, w: 0.2, h: 0.4, d: 0.2, glow: 0xffb050, glowIntensity: 1.8, shadow: false }); hotelHalo(w, sx * 4.8, 3.4, z, 2.4, 0xffa050, 0.3); }
    // rolling barrels: they come down the aisle toward you, in three lanes
    const barrels = [];
    const BZ0 = -60, BL = 42, V = 4.0;
    [[-2.6, 0], [0, 14], [2.6, 28], [-2.6, 21], [0, 35], [2.6, 7]].forEach(([lx, off], k) => {
      const bz = (t) => BZ0 + ((V * t + off) % BL);
      const hzb = w.hazard({ x: lx, y: 0.5, z: BZ0, w: 1.5, h: 1.0, d: 1.5, color: 0xff3a46, move: (t) => ({ z: bz(t) - BZ0 }) });
      hzb.core.visible = false; hzb.shell.visible = false; hzb.jumpable = true;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.3, 16), plainMaterial(0x7a4a26, { roughness: 0.55 })); barrel.rotation.z = Math.PI / 2; barrel.castShadow = true;
      const band = (yy) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.04, 6, 20), brass()); r.rotation.y = Math.PI / 2; r.position.x = yy; barrel.add(r); };
      band(-0.4); band(0.4);
      const spin = new THREE.Group(); spin.add(barrel); hzb.group.add(spin);
      w.onUpdate((dt, t) => { spin.rotation.x = -bz(t) / 0.62; });
      barrels.push(hzb);
    });
    w.sign({ text: 'KITCHEN · DELIVERIES', x: 0, y: 4.2, z: -61.7, w: 8, h: 1.2, color: '#f1d28a', double: false, tw: 1024, size: 90 });
    w.goal({ x: 0, y: 0, z: -58, color: GOLD, onReach: () => { game.say('hotel.l8.done', { priority: 2 }); game.completeLevel(); } });

    // ---- the host -------------------------------------------------------------------------------------------------------
    let t0 = 0, intro = false, cellar = false, merlot = false;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      const p = g.player;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l8.intro'); g.say('hotel.l8.intro2', { vars: { first: 'dessert' } }); }
      if (!cellar && p.z < -24) { cellar = true; g.say('hotel.l8.cellar', { priority: 1 }); }
      if (!merlot && p.z < -33) { merlot = true; g.say('hotel.l8.merlot', { priority: 1 }); }
    };
    w.hooks.onDeath = (info) => {
      if (info.reason === 'hazard' && game.player.z < WALL_Z) { game.say('hotel.l8.barrel', { priority: 2 }); return true; }
      return false;
    };
    // ---- hints: three levels of clue, then the usual trail ------------------------------------------------------------
    let hintN = 0;
    w.hintAction = (g) => {
      if (doorOpen) return 'trail';
      hintN++;
      if (hintN === 1) g.say('hotel.l8.hint1', { priority: 1 });
      else if (hintN === 2) g.say('hotel.l8.hint2', { priority: 1, vars: { a: order[0].name, b: order[1].name } });
      else g.say('hotel.l8.hint3', { priority: 1, vars: { all: order.map((c) => c.name).join(', ') } });
      return true;
    };
    w.dinner = { order, cloches, get served() { return served; }, get doorOpen() { return doorOpen; }, barrels, hz, trap, get trapBusy() { return trapBusy; }, serve: (rec) => serve(game, rec) };
    w.botPlan = (g) => {
      const p = g.player;
      if (!doorOpen) {
        const rec = cloches.find((r) => r.c === order[served]);
        if (trapBusy) return { wait: true, x: p.x, z: p.z };
        const tx = tableX[rec.i], tz = TZ + 2.4;
        if (Math.hypot(p.x - tx, p.z - tz) > 1.0) return { x: tx, z: tz };
        serve(g, rec);
        return { wait: true, x: p.x, z: p.z };
      }
      if (doorT < 1 && p.z > WALL_Z - 0.2) return p.z > WALL_Z + 3 ? { x: 0, z: WALL_Z + 2 } : { wait: true, x: p.x, z: p.z };
      if (p.z > WALL_Z + 0.4 && Math.abs(p.x) > 0.9) return { x: 0, z: WALL_Z + 2 };
      return null;
    };
  },
};
void softTexture; void glowMaterial;
