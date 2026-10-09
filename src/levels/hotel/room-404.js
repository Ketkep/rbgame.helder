import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelHalo, GOLD } from './kit.js';
import { openKeypad } from '../../engine/keypad.js';
import { inView } from '../../engine/view.js';
import { trollCheckpoint, fakeComplete, evasiveGoal, twist } from './trolls.js';
import { shuffle, rint, roomBox, wallZ, wallX, slideDoor, doorFrame, keypadBox, escapeStages, canvasPlane, darkLayer, mirror } from './escape-kit.js';

// Hotel level 11 — "Room 404" (Hard · Guest Rooms). An escape room in four stages, one checkpoint each:
//   1 The Bedroom   three digits hide in the furniture. The furniture moves when you are not looking. The wardrobe walks when you are not looking
//                   (its eyes glow while it does). Now and then the lights go out (the lights-out warning flickers first). An armchair note says
//                   the code is 404: it is not.
//   2 The Bathroom  the light cycles; when it is dark, glowing digits show on the wall opposite the mirror. They are written backwards.
//                   Read them in the mirror. (Entering the dark: the mouse is mirrored too. It is thematic.)
//   3 The Hallway   three door plaques are lit. Read them in the order you pass them. The wardrobe comes out of the first door and walks when you
//                   are not looking. The keypad at the end: the host's 404 opens a door onto Room 404, again (a loop). The real code opens the stairs.
//                   The checkpoint here forgets itself.
//   4 The Stairwell steps that crumble, a landing that slides, the lights blinking out (the steps glow at the edges), and an exit that is a lie:
//                   the cherry-on-top of a fake LEVEL COMPLETE, a real goal that runs away, and a bonus climb.
// Baby Mode: the wardrobe is slower, blackouts are shorter and rarer, the control twist is short, the expiring checkpoint keeps, the goal hops once.

const H = 5.4;
const X0 = -9.5, X1 = 9.5, Z0 = -13, Z1 = 9;
const WA = -13.4, WB = -27.6, WD = -70.0;       // wall centres (0.8 thick): bedroom|bathroom, bathroom|hallway, hallway|stairwell
const SLOTS = [[-6.6, -9.0], [-6.6, -2.0], [-6.6, 5.0], [6.6, -9.0], [6.6, -2.0], [6.6, 5.0]];
const NAMES = ['The Bedroom', 'The Bathroom', 'The Hallway', 'The Stairwell'];
const HALL_HOME = { x: -2.3, z: -31.4 };
const wood = (c = 0x6a4a2a) => plainMaterial(c, { roughness: 0.55 });
const PANEL = { tex: 'panel', color: 0xc8b8a8, roughness: 0.7 };

export default {
  id: 'hotel-11',
  name: 'Room 404',
  music: 'hotel_dark',
  completeQuip: 'You left Room 404. It will be there, unseen, behind you. Do not look back. It cannot move when you do.',

  build(w, game) {
    w.env({
      top: 0x0a0a14, horizon: 0x1c1826, bottom: 0x08080c,
      fog: { color: 0x12101a, near: 25, far: 90 },
      sun: { color: 0xc0c8ff, intensity: 0.15, dir: [0.3, 0.9, 0.3], shadow: false },
      hemi: { sky: 0xffe0c0, ground: 0x6a5a60, intensity: 0.8 },
      exposure: 0.92, stars: 0,
      bloom: { strength: 0.4, radius: 0.6, threshold: 0.95 },
      motes: { color: 0xffe0b0, count: 90, size: 0.06, opacity: 0.4 },
      envMap: { top: 0xffe0c0, mid: 0x4a3a40, bottom: 0x100c10, intensity: 0.35, lights: [{ pos: [0, 5, 0], w: 8, h: 8, color: 0xffe2b0, intensity: 2.0 }] },
    });
    w.setTheme({ tex: 'carpet', color: 0xffffff, trim: null, edge: null, edgeOpacity: 0, roughness: 0.8, metalness: 0, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.spawn = { x: 0, y: 0, z: 6.5, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -12;
    const baby = () => game.baby;
    const zoneOf = (z) => (z > WA ? 'bed' : z > WB ? 'bath' : z > WD ? 'hall' : 'stairs');
    const timers = new Set();
    const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
    w.onDispose(() => { for (const id of timers) clearTimeout(id); });
    const dk = darkLayer(w);

    // =====================================================================================================
    //  The building
    // =====================================================================================================
    // the bedroom
    w.plat({ x: 0, y: 0, z: (Z1 + 1 + WA) / 2, w: 20, d: Z1 + 1 - WA, h: 2, tex: 'carpet', color: 0x6f7fa0, roughness: 0.95 });
    roomBox(w, { x0: X0, x1: X1, z0: Z0 - 0.4, z1: Z1, H, ceil: { tex: 'coffer', color: 0xc8b8a8 }, walls: { w: true, e: true, s: true }, wallMat: PANEL });
    w.light(0xffe0b0, 12, 18, 0, 4.4, 2); w.light(0xffd0a0, 8, 12, 0, 4.2, -8); w.light(0xffa860, 7, 9, -6, 1.8, 6);
    w.box({ x: 0, y: 3.0, z: Z1 + 0.35, w: 3.2, h: 1.8, d: 0.08, color: 0x2a3a5a, rough: 0.5, shadow: false });
    w.box({ x: 0, y: 3.0, z: Z1 + 0.3, w: 3.5, h: 2.1, d: 0.06, color: GOLD, metal: 1, rough: 0.4, shadow: false });
    const doorA = slideDoor(w, game, { x: 0, z: WA, width: 3.4, height: 3.3, tex: 'wood', color: 0x5a3a24 });
    wallZ(w, { z: WA, x0: X0 - 0.8, x1: X1 + 0.8, y0: -2, y1: H, gaps: [{ c: 0, w: 3.4, h: 3.3 }], mat: PANEL });
    w.sign({ text: '404', x: 0, y: 3.3 + 0.75, z: WA + 0.46, w: 1.8, h: 0.8, color: '#d8a94a', double: false, tw: 256, size: 130 });
    // the bathroom
    const BX = 6.2;
    w.plat({ x: 0, y: 0, z: (WA + WB) / 2, w: 2 * BX, d: WA - WB, h: 2, tex: 'tile', color: 0xc8d0d6, roughness: 0.3 });
    roomBox(w, { x0: -BX, x1: BX, z0: WB + 0.4, z1: WA - 0.4, H: 4.4, ceil: { tex: 'tile', color: 0xdfe4ea }, walls: { w: true, e: true }, wallMat: { tex: 'tile', color: 0xdde4e8 } });
    const doorB = slideDoor(w, game, { x: 0, z: WB, width: 2.8, height: 3.3, tex: 'wood', color: 0x5a3a24 });
    wallZ(w, { z: WB, x0: -BX - 0.8, x1: BX + 0.8, y0: -2, y1: 4.4, gaps: [{ c: 0, w: 2.8, h: 3.3 }], mat: { tex: 'tile', color: 0xdde4e8 } });
    // the hallway
    const HX = 3.7;
    w.plat({ x: 0, y: 0, z: (WB + WD) / 2, w: 2 * HX, d: WB - WD, h: 2, tex: 'carpet', color: 0x7a2030, roughness: 0.95 });
    roomBox(w, { x0: -HX, x1: HX, z0: WD + 0.4, z1: WB - 0.4, H: 4.4, ceil: { tex: 'coffer', color: 0xb8a898 }, walls: { w: true, e: true }, wallMat: PANEL });
    w.box({ x: 0, y: 0.012, z: (WB + WD) / 2, w: 2.4, h: 0.02, d: WB - WD - 0.2, color: 0x2a1018, rough: 0.9, shadow: false });
    const STAIRS_X = 2.4, LOOP_X = -2.4;
    wallZ(w, { z: WD, x0: -HX - 0.8, x1: HX + 0.8, y0: -2, y1: 14, gaps: [{ c: LOOP_X, w: 2.2, h: 3.0 }, { c: STAIRS_X, w: 2.2, h: 3.0 }], mat: PANEL });
    const doorLoop = slideDoor(w, game, { x: LOOP_X, z: WD, width: 2.2, height: 3.0, tex: 'wood', color: 0x5a3a24 });
    const doorStairs = slideDoor(w, game, { x: STAIRS_X, z: WD, width: 2.2, height: 3.0, tex: 'metal', color: 0x6a8a74 });
    doorFrame(w, { x: LOOP_X, z: WD, width: 2.2, height: 3.0 }); doorFrame(w, { x: STAIRS_X, z: WD, width: 2.2, height: 3.0 });
    w.sign({ text: 'ROOM 404', x: LOOP_X, y: 3.7, z: WD + 0.46, w: 2.0, h: 0.6, color: '#d8a94a', double: false, tw: 512, size: 90 });
    w.sign({ text: 'EXIT · STAIRS', x: STAIRS_X, y: 3.7, z: WD + 0.46, w: 2.2, h: 0.6, color: '#6cf0b2', double: false, tw: 512, size: 80, glow: true });
    w.light(0xffe0b0, 9, 14, 0, 3.6, -34); w.light(0xffd0a0, 9, 14, 0, 3.6, -48); w.light(0xffd0a0, 9, 14, 0, 3.6, -62);
    // the stairwell
    const SX = 6;
    w.plat({ x: 0, y: 0, z: -73.3, w: 2 * SX, d: 6.6, h: 2, tex: 'stone', color: 0x8a8478, roughness: 0.8 });
    roomBox(w, { x0: -SX, x1: SX, z0: -102, z1: WD - 0.4, y: 0, H: 13, ceil: { tex: 'metal', color: 0x3a3e48 }, walls: { w: true, e: true, n: true }, wallMat: { tex: 'stone', color: 0x8a8478 }, yb: -14 });
    w.light(0xffc890, 14, 24, 0, 5, -78); w.light(0xffb070, 14, 24, 0, 9, -92); w.light(0x9affc8, 8, 14, 0, 11, -100);

    // =====================================================================================================
    //  Stage 1 · the bedroom
    // =====================================================================================================
    const codeA = String(rint(100, 999)).replace(/404/, '405');
    const fake = '404';
    const padA = keypadBox(w, game, { x: 3.1, z: WA + 0.47, face: 's', label: () => (doorA.open ? 'Unlocked' : 'Use keypad'), use: (g) => { if (!doorA.open) useKeypadA(g); } });
    let attemptsA = 0;
    const found = [null, null, null];
    const digitsAt = shuffle([0, 1, 2]);
    const useKeypadA = (g) => openKeypad(g, {
      title: 'ROOM 404 · ENTER CODE', digits: 3,
      info: () => 'Notes — ' + found.map((d, i) => `Digit ${i + 1}: ${d === null ? '?' : d}`).join(' · '),
      onSubmit: (c, api) => {
        if (c === codeA) { api.setMsg('UNLOCKED', 'good'); g.audio.confirm(); w.after(0.6, () => { api.close(); doorA.openDoor(); padA.setLed(0x40ff88); w.after(0.5, () => g.say('hotel.l11.open', { priority: 2 })); }); }
        else {
          attemptsA++; g.audio.buzzer(); api.clear(); api.setMsg('WRONG', 'bad');
          if (c === fake) g.say('hotel.l11.fake', { priority: 2 });
          else if (attemptsA % 3 === 0) { g.say('hotel.l11.lock', { priority: 2 }); api.lockout(8); }
          else g.say('hotel.l11.denied', { priority: 1 });
        }
      },
    });
    // ---- the furniture (it moves when you do not look) ----------------------------------------------------------------------
    const pieces = [];
    const makePiece = (name, kind, dims) => {
      const [fw, fd, top] = dims;
      const pl = w.plat({ x: 0, y: top, z: 0, w: fw, d: fd, h: top, tex: kind.tex, color: kind.color, roughness: 0.6, radius: 0.06 });
      pl.o.moving = true; pl.group.matrixAutoUpdate = true;
      const extra = new THREE.Group(); pl.group.add(extra);
      return { name, pl, fw, fd, top, extra, slot: -1, unseen: 0, dig: -1, searched: false, it: null, cx: 0, cz: 0 };
    };
    const bed = makePiece('bed', { tex: 'leather', color: 0x4a2a3a }, [3.0, 2.2, 0.7]);
    { const pillow = (x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.5), plainMaterial(0xf4f0e8, { roughness: 0.8 })); m.position.set(x, 0.4, -0.7); bed.extra.add(m); }; pillow(-0.7); pillow(0.7); const blanket = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 1.4), plainMaterial(0x7a2a3a, { roughness: 0.9 })); blanket.position.set(0, 0.1, 0.4); bed.extra.add(blanket); const head = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.2, 0.15), wood(0x4a2a18)); head.position.set(0, 0.45, -1.15); bed.extra.add(head); }
    const desk = makePiece('desk', { tex: 'wood', color: 0xb08a5a }, [2.4, 1.1, 0.95]);
    { const tv = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.1), plainMaterial(0x0c0c10, { roughness: 0.2 })); tv.position.set(0, 0.7, -0.2); desk.extra.add(tv); const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), glowMaterial(0x203a50, 0.8)); scr.position.set(0, 0.7, -0.14); desk.extra.add(scr); const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.4, 10), glowMaterial(0xffd890, 1.4)); lamp.position.set(0.9, 0.7, 0.1); desk.extra.add(lamp); }
    const dresser = makePiece('dresser', { tex: 'wood', color: 0x8a6a42 }, [2.0, 0.9, 1.15]);
    { for (let k = 0; k < 3; k++) { const kn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); kn.position.set(-0.5 + k * 0.5, 0.1, 0.46); dresser.extra.add(kn); } const mir = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.06), plainMaterial(0xcfd8e4, { metalness: 1, roughness: 0.05 })); mir.position.set(0, 1.0, -0.4); dresser.extra.add(mir); }
    const chair = makePiece('armchair', { tex: 'leather', color: 0x2a4a3a }, [1.3, 1.3, 0.8]);
    { const back = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 0.25), plainMaterial(0x2a4a3a, { roughness: 0.7 })); back.position.set(0, 0.6, -0.55); chair.extra.add(back); }
    pieces.push(bed, desk, dresser, chair);
    [bed, desk, dresser].forEach((p, i) => { p.dig = digitsAt[i]; });
    chair.dig = -1;
    const slotOrder = shuffle([0, 1, 2, 3, 4, 5]);
    const slotOwner = Array(6).fill(null);
    const place = (p, si) => {
      if (p.slot >= 0) slotOwner[p.slot] = null;
      p.slot = si; slotOwner[si] = p;
      const [sx, sz] = SLOTS[si]; p.cx = sx; p.cz = sz;
      p.pl.setPos(sx, p.top - p.pl.o.h / 2, sz);
      if (p.it) p.it.body.setCenter(sx, p.top + 0.35, sz);
    };
    pieces.forEach((p, i) => place(p, slotOrder[i]));
    pieces.forEach((p) => {
      p.it = w.interactable({
        x: p.cx, y: p.top + 0.35, z: p.cz, w: Math.max(p.fw, 1.0), h: 1.2, d: Math.max(p.fd, 1.0), range: 3.4, pad: 0.1,
        label: () => (p.searched ? `The ${p.name} (searched)` : `Search the ${p.name}`),
        onUse: (g) => searchPiece(g, p),
      });
      p.it.body.setCenter(p.cx, p.top + 0.35, p.cz);
    });
    function searchPiece(g, p) {
      if (doorA.open) return;
      g.audio.click();
      if (p === chair) { p.searched = true; g.ui.toast('A note: “The code is 404.” — H.', 'gold'); g.say('hotel.l11.note', { priority: 2 }); return; }
      const di = p.dig, was = found[di] !== null;
      found[di] = Number(codeA[di]); p.searched = true;
      g.ui.toast(`Digit ${di + 1} = ${codeA[di]}  (${p.name})`, 'gold'); g.audio.confirm();
      if (!was) { const n = found.filter((d) => d !== null).length; g.say(n === 3 ? 'hotel.l11.all' : n === 1 ? 'hotel.l11.first' : 'hotel.l11.second', { priority: 1 }); }
    }

    // ---- the wardrobe (frozen while watched; one wardrobe, two rooms) -------------------------------------------------------
    const ward = { x: 6.6, z: -9.0, speed: 2.1, moving: false, active: false, seenT: 0, room: 'bed' };
    const bedHome = () => ({ x: SLOTS[slotOrder[4]][0], z: SLOTS[slotOrder[4]][1] });
    { const h = bedHome(); ward.x = h.x; ward.z = h.z; }
    const wardPl = w.plat({ x: ward.x, y: 2.4, z: ward.z, w: 1.7, d: 1.0, h: 2.4, tex: 'wood', color: 0x3a2412, roughness: 0.5, radius: 0.05 });
    wardPl.o.moving = true; wardPl.group.matrixAutoUpdate = true;
    for (const sx of [-1, 1]) { const handle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); handle.position.set(sx * 0.1, 0.1, 0.52); wardPl.group.add(handle); }
    const door1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.0, 0.02), plainMaterial(0x120a04)); door1.position.set(0, 0, 0.51); wardPl.group.add(door1);
    const eyeMat = glowMaterial(0xffd23f, 2.4);
    const eyes = [-0.3, 0.3].map((ex) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeMat); e.position.set(ex, 0.65, 0.52); e.visible = false; wardPl.group.add(e); return e; });
    const setWard = () => wardPl.setPos(ward.x, 1.2, ward.z);
    setWard();
    const WARD_START = 14;
    const sched = { dark: false, until: 0, next: 22, warn: false, zone: 'bed' };
    let tLevel = 0;
    const WARD_RESET = (zone) => {
      ward.active = false; ward.seenT = 0; ward.room = zone === 'bed' || zone === 'bath' ? 'bed' : zone === 'hall' ? 'hall' : 'none';
      const h = ward.room === 'hall' ? HALL_HOME : bedHome();
      ward.x = h.x; ward.z = h.z; setWard();
    };
    w.onRespawn(() => { const z = zoneOf(w.respawn.z); WARD_RESET(z); sched.dark = false; sched.warn = false; dk.set(0, 100); sched.next = tLevel + 22; sched.zone = z; });
    const clampW = () => {
      if (ward.room === 'hall') { ward.x = Math.max(-HX + 1.0, Math.min(HX - 1.0, ward.x)); ward.z = Math.max(WD + 1.0, Math.min(WB - 1.0, ward.z)); }
      else { ward.x = Math.max(X0 + 1.1, Math.min(X1 - 1.1, ward.x)); ward.z = Math.max(Z0 + 1.0, Math.min(Z1 - 1.0, ward.z)); }
    };
    let botGlance = false;                            // (test bot only: it is a player who keeps an eye on the thing)
    const observed = (x, y, z, margin) => !sched.dark && inView(game, x, y, z, margin);
    let movedSaid = false, stepSaid = false, bathLit = true, bathT = 0, bathTwisted = false, hallSaid = false;
    const BATH = () => ({ on: baby() ? 5.5 : 4.2, off: baby() ? 6.5 : 5.0 });
    const ZONE = {
      bed: { first: 22, gap: () => 20 + Math.random() * 8, len: () => (baby() ? 1.6 : 2.6) },
      hall: { first: 9, gap: () => 12 + Math.random() * 5, len: () => (baby() ? 1.2 : 1.9) },
      stairs: { first: 5, gap: () => 9 + Math.random() * 4, len: () => 1.6 },
    };
    w.onUpdate((dt) => {
      if (game.state !== 'playing') return;
      tLevel += dt;
      const p = game.player, zone = zoneOf(p.z);
      if (zone !== sched.zone) {
        sched.zone = zone; sched.dark = false; sched.warn = false; dk.set(0, 150);
        sched.next = tLevel + (ZONE[zone]?.first ?? 9999);
        if (zone === 'hall') { WARD_RESET('hall'); }
        if (zone === 'bath') { bathLit = true; bathT = 0; }
        if (zone === 'bed') WARD_RESET('bed');
      }
      // ---- lights out (bedroom, hallway, stairwell) -------------------------------------------------------------------
      const Z = ZONE[zone];
      if (Z) {
        if (!sched.dark && tLevel > sched.next - 1.3 && !sched.warn) { sched.warn = true; game.audio.glitch(); }
        if (sched.warn && !sched.dark) { dk.set(Math.floor(tLevel * 14) % 2 ? 0.55 : 0.0, 60); if (tLevel > sched.next) { sched.dark = true; sched.until = tLevel + Z.len(); dk.set(0.93, 120); if (zone === 'bed') game.say('hotel.l11.dark', { priority: 1 }); } }
        if (sched.dark && tLevel > sched.until) { sched.dark = false; sched.warn = false; dk.set(0, 300); sched.next = tLevel + Z.gap(); }
      }
      // ---- the bathroom: the light cycles ------------------------------------------------------------------------------
      if (zone === 'bath') {
        bathT += dt;
        const B = BATH();
        if (bathLit && bathT > B.on) {
          bathLit = false; bathT = 0; dk.set(0.7, 140); setDigits(true);
          if (!bathTwisted) { bathTwisted = true; twist(game, w, 'mouseX', { sec: 8, say: 'hotel.l11.mirror' }); }
        } else if (!bathLit && bathT > B.off) { bathLit = true; bathT = 0; dk.set(0, 200); setDigits(false); }
      }
      // ---- the furniture moves when unseen (bedroom only) ---------------------------------------------------------------
      if (zone === 'bed') for (const pc of pieces) {
        const seen = observed(pc.cx, pc.top * 0.7 + 0.2, pc.cz, 0.35);
        const dist = Math.hypot(pc.cx - p.x, pc.cz - p.z);
        const onTop = p.grounded && p.ground === pc.pl.body;
        if (seen || dist < 4 || onTop) pc.unseen = 0; else pc.unseen += dt;
        if (pc.unseen > 1.4) {
          const free = [0, 1, 2, 3, 4, 5].filter((s) => !slotOwner[s] && Math.hypot(SLOTS[s][0] - ward.x, SLOTS[s][1] - ward.z) > 3.2 && Math.hypot(SLOTS[s][0] - p.x, SLOTS[s][1] - p.z) > 3.8);
          if (free.length) { place(pc, free[Math.floor(Math.random() * free.length)]); game.audio.crumble(); pc.unseen = 0; if (!movedSaid) { movedSaid = true; game.say('hotel.l11.moved', { priority: 1 }); } }
          else pc.unseen = 0.6;
        }
      }
      // ---- the wardrobe --------------------------------------------------------------------------------------------------
      if (zone === 'bed' && !ward.active && tLevel > WARD_START) { ward.active = true; game.say('hotel.l11.ward', { priority: 1 }); }
      if (zone === 'hall' && !ward.active && p.z < -37) { ward.active = true; game.say('hotel.l11.hallward', { priority: 2 }); }
      const inRoom = (zone === 'bed' && ward.room === 'bed') || (zone === 'hall' && ward.room === 'hall');
      const watched = botGlance || observed(ward.x, 1.3, ward.z, 0.3);
      ward.moving = ward.active && inRoom && !watched;
      for (const e of eyes) e.visible = ward.moving;
      if (ward.moving) {
        const dx = p.x - ward.x, dz = p.z - ward.z, d = Math.hypot(dx, dz) || 1;
        const base = ward.room === 'hall' ? 4.6 : 2.1;
        const sp = base * (baby() ? 0.7 : 1) * (sched.dark ? 1.15 : 1);
        ward.x += (dx / d) * sp * dt; ward.z += (dz / d) * sp * dt; clampW(); setWard();
        if (Math.hypot(ward.x - p.x, ward.z - p.z) < 1.35 && Math.abs(p.y) < 2.4) { game.say('hotel.l11.caught', { priority: 2 }); game.kill('wardrobe'); }
        if (!stepSaid && d < 6) { stepSaid = true; game.say('hotel.l11.close', { priority: 1 }); }
        if (d > 9) stepSaid = false;
      }
      if (zone === 'hall' && !hallSaid && p.z < -31) { hallSaid = true; game.say('hotel.l11.hall', { priority: 1 }); }
    });

    // =====================================================================================================
    //  Stage 2 · the bathroom (the mirror)
    // =====================================================================================================
    let codeB; do { codeB = String(rint(100, 999)); } while (codeB === '404' || codeB === codeA);
    { // fittings
      w.box({ x: -4.4, y: 0.5, z: -24.8, w: 3.6, h: 1.0, d: 1.6, color: 0xf2f4f6, rough: 0.2 });                 // the tub
      w.box({ x: -4.4, y: 0.62, z: -24.8, w: 3.2, h: 0.9, d: 1.2, color: 0x9ab8c8, rough: 0.1, shadow: false });
      w.collider({ x: -4.4, y: 0.5, z: -24.8, w: 3.6, h: 1.0, d: 1.6 });
      w.box({ x: 4.9, y: 0.45, z: -15.6, w: 1.2, h: 0.9, d: 0.6, color: 0xf2f4f6, rough: 0.2 });                  // the sink
      w.collider({ x: 4.9, y: 0.45, z: -15.6, w: 1.2, h: 0.9, d: 0.6 });
      w.box({ x: -5.2, y: 0.4, z: -15.4, w: 0.7, h: 0.8, d: 0.9, color: 0xf2f4f6, rough: 0.2 });                  // and the toilet (sitting very quietly)
      w.collider({ x: -5.2, y: 0.4, z: -15.4, w: 0.7, h: 0.8, d: 0.9 });
    }
    w.light(0xcfe8ff, 10, 18, 0, 3.6, -18); w.light(0xcfe8ff, 8, 14, 0, 3.4, -24);
    for (const z of [-17, -23]) { w.box({ x: 0, y: 4.25, z, w: 2.0, h: 0.1, d: 0.3, glow: 0xdff4ff, glowIntensity: 1.4, shadow: false }); hotelHalo(w, 0, 3.9, z, 3.5, 0xcfe8ff, 0.12); }
    const mir = mirror(w, game, { x: -BX + 0.04, y: 1.95, z: -20.5, width: 7.0, height: 2.4, face: 'e', res: 384 });
    void mir;
    const digitsPlanes = [0, 1, 2].map((k) => {
      const m = canvasPlane(w, {
        x: BX - 0.04, y: 1.95, z: -17.5 - k * 3.0, width: 1.5, height: 1.8, rotY: -Math.PI / 2, px: 256, transparent: true, double: false,
        draw: (g, cw, ch) => { g.clearRect(0, 0, cw, ch); g.save(); g.translate(cw, 0); g.scale(-1, 1); g.fillStyle = '#9dffb0'; g.shadowColor = '#5aff9a'; g.shadowBlur = 24; g.font = '700 190px "Archivo Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(codeB[k], cw / 2, ch / 2 + 8); g.restore(); },
      });
      m.visible = false; return m;
    });
    function setDigits(on) { for (const m of digitsPlanes) m.visible = on; }
    w.sign({ text: 'LIGHTS ARE ON A TIMER · READ WHAT THE MIRROR READS', x: 0.0, y: 3.3, z: WB + 0.46, w: 7, h: 0.5, color: '#9fb2c8', double: false, tw: 1024, size: 36 });
    const padB = keypadBox(w, game, { x: 2.4, z: WB + 0.47, face: 's', label: () => (doorB.open ? 'Unlocked' : 'Use keypad'), use: (g) => { if (!doorB.open) useKeypadB(g); } });
    let attemptsB = 0;
    const useKeypadB = (g) => openKeypad(g, {
      title: 'BATHROOM DOOR · ENTER CODE', digits: 3,
      onSubmit: (c, api) => {
        if (c === codeB) { api.setMsg('UNLOCKED', 'good'); g.audio.confirm(); w.after(0.6, () => { api.close(); doorB.openDoor(); padB.setLed(0x40ff88); w.after(0.5, () => g.say('hotel.l11.b.open', { priority: 2 })); }); }
        else {
          attemptsB++; g.audio.buzzer(); api.clear(); api.setMsg('WRONG', 'bad');
          const rev = codeB.split('').reverse().join('');
          if (c === rev && rev !== codeB) g.say('hotel.l11.b.rev', { priority: 2 });
          else if (attemptsB % 3 === 0) { g.say('hotel.l11.lock', { priority: 2 }); api.lockout(6); }
          else g.say('hotel.l11.denied', { priority: 1 });
        }
      },
    });

    // =====================================================================================================
    //  Stage 3 · the hallway (the lit plaques, the keypad, the wardrobe)
    // =====================================================================================================
    let codeC; do { codeC = String(rint(100, 999)); } while (codeC === '404' || codeC === codeA || codeC === codeB);
    const hallZs = [-33.5, -37.5, -41.5, -45.5, -49.5, -53.5, -57.5, -61.5, -65.5];
    const litIdx = [rint(0, 2), rint(3, 5), rint(6, 8)];
    const plates = [];
    hallZs.forEach((z, i) => {
      const side = i % 2 ? 1 : -1, lit = litIdx.indexOf(i);
      const x = side * (HX - 0.05);
      w.box({ x: side * (HX - 0.08), y: 1.2, z, w: 0.16, h: 2.4, d: 1.3, tex: 'wood', color: 0x5a3a24, shadow: false });
      w.box({ x: side * (HX - 0.16), y: 1.9, z, w: 0.05, h: 0.4, d: 0.5, color: 0x9a7a3a, metal: 1, rough: 0.35, shadow: false });
      const m = canvasPlane(w, {
        x: side * (HX - 0.2), y: 1.9, z, width: 0.46, height: 0.34, rotY: side < 0 ? Math.PI / 2 : -Math.PI / 2, px: 128, basic: lit >= 0,
        draw: (g, cw, ch) => {
          g.fillStyle = lit >= 0 ? '#2a1c08' : '#8a6a2a'; g.fillRect(0, 0, cw, ch);
          g.fillStyle = lit >= 0 ? '#ffe49a' : '#6a4e1a'; g.font = '700 84px "Archivo Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(lit >= 0 ? codeC[lit] : '', cw / 2, ch / 2 + 4);
        },
      });
      if (lit >= 0) { w.box({ x: side * (HX - 0.12), y: 2.35, z, w: 0.06, h: 0.12, d: 0.7, glow: 0xffd890, glowIntensity: 1.8, shadow: false }); hotelHalo(w, side * (HX - 0.7), 1.9, z, 1.6, 0xffc070, 0.28); }
      void x; plates.push({ z, lit: lit >= 0, m });
    });
    // two or three wall lamps and a long mirror-less hall: pictures of the guests (one of them is you)
    for (const z of [-36, -44, -52, -60, -68]) for (const s of [-1, 1]) w.box({ x: s * (HX - 0.15), y: 3.2, z, w: 0.12, h: 0.4, d: 0.3, glow: 0xffd8a0, glowIntensity: 1.0, shadow: false });
    // the keypad between the two doors
    const padC = keypadBox(w, game, { x: 0, z: WD + 0.47, face: 's', label: () => (doorStairs.open ? 'Unlocked' : 'Use keypad'), use: (g) => { if (!doorStairs.open) useKeypadC(g); } });
    let attemptsC = 0;
    const useKeypadC = (g) => openKeypad(g, {
      title: 'EXIT · ENTER CODE', digits: 3,
      onSubmit: (c, api) => {
        if (c === codeC) { api.setMsg('UNLOCKED', 'good'); g.audio.confirm(); w.after(0.5, () => { api.close(); doorStairs.openDoor(); padC.setLed(0x40ff88); w.after(0.5, () => g.say('hotel.l11.h.open', { priority: 2 })); }); }
        else if (c === fake) {                                                   // the host's number: it opens a door. The wrong door.
          api.setMsg('ACCESS GRANTED', 'good'); g.audio.confirm();
          w.after(0.5, () => { api.close(); doorLoop.openDoor(); w.after(0.4, () => g.say('hotel.l11.h.loopdoor', { priority: 2 })); });
        } else {
          attemptsC++; g.audio.buzzer(); api.clear(); api.setMsg('WRONG', 'bad');
          if (attemptsC % 3 === 0) { g.say('hotel.l11.lock', { priority: 2 }); api.lockout(6); } else g.say('hotel.l11.denied', { priority: 1 });
        }
      },
    });
    // the door that opens onto Room 404, again
    w.trigger({
      x: LOOP_X, y: 1.5, z: WD, w: 2.0, h: 3.0, d: 1.4, once: false, onEnter: () => {
        if (!doorLoop.open || game.state !== 'playing') return;
        game.say('hotel.l11.loop', { priority: 2 }); game.ui.toast('ROOM 404', 'bad'); game.ui.glitch(true); game.audio.glitch();
        later(260, () => game.ui.glitch(false));
        game.player.teleport(0, 0.001, WB - 1.6); game.yaw = 0; game.pitch = 0;
        doorLoop.close(); WARD_RESET('hall'); ward.active = false;
      },
    });
    const cpBath = w.checkpoint({ x: 0, y: 0, z: -15.6, real: true });
    trollCheckpoint(w, game, { x: 0, y: 0, z: -29.8, mode: 'expire', ttl: 30, say: 'hotel.l11.expired' });
    const cpStairs = w.checkpoint({ x: 0, y: 0, z: -72.4, real: true });

    // =====================================================================================================
    //  Stage 4 · the stairwell (up in the dark; the exit is a lie; the goal runs)
    // =====================================================================================================
    const path = (p) => { p.o.path = true; return p; };
    const edge = (p) => { w.box({ x: p.body.x, y: p.top + 0.03, z: p.body.z + p.body.hz - 0.06, w: p.body.hx * 2 - 0.2, h: 0.04, d: 0.08, glow: 0x6affc0, glowIntensity: 1.6, shadow: false }); w.box({ x: p.body.x, y: p.top + 0.03, z: p.body.z - p.body.hz + 0.06, w: p.body.hx * 2 - 0.2, h: 0.04, d: 0.08, glow: 0x6affc0, glowIntensity: 1.6, shadow: false }); return p; };
    const step = (x, z, top, ww = 3.4, dd = 2.4, o = {}) => {
      const p = edge(path(w.plat({ x, y: top, z, w: ww, d: dd, h: 0.5, tex: 'stone', color: 0xa89c88, roughness: 0.8, radius: 0.04, ...o })));
      w.box({ x, y: (top - 0.5 - 14) / 2, z, w: Math.max(0.6, ww - 1.0), h: top + 14, d: Math.max(0.6, dd - 1.0), color: 0x4a4640, rough: 0.9, shadow: false });
      return p;
    };
    const stairs = [];
    [[-2.6, -76.6, 0.8], [2.2, -79.4, 1.6], [-2.6, -82.2, 2.4], [2.2, -85.0, 3.2, 'crumble'], [-2.6, -87.8, 4.0], [2.2, -90.6, 4.8], [0, -93.2, 5.6, 'mover'], [-2.8, -95.9, 6.4, 'crumble'], [2.4, -98.0, 7.2]].forEach(([x, z, top, kind]) => {
      let p = step(x, z, top);
      if (kind === 'crumble') p = w.crumble(p, { delay: 0.7, gone: 3 });
      if (kind === 'mover') w.mover(p, (t) => ({ x: 1.8 * Math.sin(t * 0.9) }));
      stairs.push(p);
    });
    const landing = step(0, -100.4, 8.0, 10.2, 2.8);
    stairs.push(landing);
    w.sign({ text: 'EXIT', x: 0, y: 11.2, z: -101.7, w: 3, h: 1.0, color: '#6cf0b2', double: false, tw: 512, size: 130, glow: true });
    w.light(0x9affc8, 10, 16, 0, 9.5, -99);
    // the bonus climb: a fake LEVEL COMPLETE first
    const bonus = [[-4.4, -97.2, 8.7, 2.2], [-4.4, -93.4, 9.4, 2.2], [-4.4, -89.6, 10.1, 2.2], [-1.0, -86.6, 10.7, 3.2]].map(([x, z, top, s]) => {
      const p = w.plat({ x, y: top, z, w: s, d: s, h: 0.3, tex: 'stone', color: 0xc8c0a8, roughness: 0.7, radius: 0.05 }); p.o.path = true; p.setEnabled(false); p.group.visible = false; return p;
    });
    const finalGoal = w.goal({ x: -1.0, y: 10.7, z: -86.6, color: GOLD, onReach: () => { game.say('hotel.l11.done', { priority: 2 }); game.completeLevel(); } });
    finalGoal.group.visible = false; finalGoal.trig.enabled = false;
    let bonusOn = false;
    const enableBonus = () => {
      bonusOn = true;
      for (const p of bonus) { p.setEnabled(true); p.group.visible = true; w.burst(new THREE.Vector3(p.body.x, p.top + 0.3, p.body.z), GOLD, 12, 3); }
      finalGoal.group.visible = true; finalGoal.trig.enabled = true; w.goalObj = finalGoal;
      game.say('hotel.l11.bonus', { priority: 2 });
    };
    const runner = evasiveGoal(w, game, {
      spots: [{ x: -4.0, y: 8.0, z: -100.4 }, { x: 4.0, y: 8.0, z: -100.6 }, { x: 0, y: 8.0, z: -100.2 }], radius: 3.4, color: 0x6cf0b2, say: ['hotel.l11.hop1', 'hotel.l11.hop2'],
      onReach: () => { if (!fakeComplete(game, w, { title: 'LEVEL COMPLETE', say: 'hotel.l11.fakewin', then: enableBonus })) game.completeLevel(); },
    });
    w.goalObj = runner;

    // =====================================================================================================
    //  The host, the stages, the hint
    // =====================================================================================================
    const S = escapeStages(w, game, [
      { name: NAMES[0], at: { x: 0, y: 0, z: 6.5 }, clues: ['hotel.l11.hint1', 'hotel.l11.hint2', 'hotel.l11.hint3'], vars: () => ({ code: codeA }), solved: () => doorA.open, trail: [{ x: 0, y: 0, z: -4 }, { x: 0, y: 0, z: -12 }] },
      { name: NAMES[1], at: { x: 0, y: 0, z: -15.6 }, clues: ['hotel.l11.b.hint1', 'hotel.l11.b.hint2', 'hotel.l11.b.hint3'], vars: () => ({ code: codeB }), solved: () => doorB.open, trail: [{ x: 0, y: 0, z: -22 }, { x: 0, y: 0, z: -26 }] },
      { name: NAMES[2], at: { x: 0, y: 0, z: -29.8 }, clues: ['hotel.l11.h.hint1', 'hotel.l11.h.hint2', 'hotel.l11.h.hint3'], vars: () => ({ code: codeC }), solved: () => doorStairs.open, trail: [{ x: 0, y: 0, z: -45 }, { x: 0, y: 0, z: -60 }, { x: STAIRS_X, y: 0, z: -68.4 }] },
      { name: NAMES[3], at: { x: 0, y: 0, z: -72.4 }, trail: () => (bonusOn ? bonus.map((b) => ({ x: b.body.x, y: b.top, z: b.body.z })) : stairs.map((p) => ({ x: p.body.x, y: p.top, z: p.body.z }))), end: () => ({ x: (bonusOn ? finalGoal : runner).x, y: (bonusOn ? finalGoal : runner).y, z: (bonusOn ? finalGoal : runner).z }) },
    ]);
    const cps = new Map([[cpBath, 1], [cpStairs, 3]]);
    w.hooks.onCheckpoint = (c) => {
      const i = cps.get(c);
      if (i === undefined) return;
      S.enter(i);
      if (i === 1) game.say('hotel.l11.bath', { priority: 1 });
      if (i === 3) game.say('hotel.l11.stairs', { priority: 1 });
    };
    // (the expiring hallway checkpoint announces itself with the kit's toast; the stage banner comes from this trigger)
    w.trigger({ x: 0, y: 1.2, z: -29.8, w: 3, h: 3, d: 2.4, once: true, onEnter: () => S.enter(2) });
    let t0 = 0, intro = false;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l11.intro'); g.say('hotel.l11.intro2'); S.banner(); }
    };
    w.hooks.onDeath = (info) => {
      const p = game.player;
      if (info.reason === 'wardrobe') return true;
      if (info.reason === 'void' && p.z < WD) { game.say('hotel.l11.fall', { priority: 1 }); return true; }
      return false;
    };
    w.onDispose(() => { dk.el.remove(); });
    w.room404 = {
      pieces, ward, code: codeA, fake, found, codeB, codeC, get doorOpen() { return doorA.open; }, get dark() { return sched.dark; }, get tLevel() { return tLevel; },
      search: (p) => searchPiece(game, p), useKeypad: () => useKeypadA(game), setDark: (v) => { sched.dark = v; if (v) sched.until = tLevel + 5; }, slots: SLOTS,
      doorA, doorB, doorLoop, doorStairs, useKeypadB: () => useKeypadB(game), useKeypadC: () => useKeypadC(game), stages: S, bath: { get lit() { return bathLit; }, digits: digitsPlanes, set t(v) { bathT = v; } },
      plates, runner, finalGoal, bonus, stairs, get bonusOn() { return bonusOn; }, zoneOf, HALL_HOME, WARD_RESET, get twisted() { return bathTwisted; },
    };

    // =====================================================================================================
    //  The bot
    // =====================================================================================================
    const goTo = (x, z, tol = 0.8) => { const p = game.player; return Math.hypot(p.x - x, p.z - z) > tol ? { x, z } : null; };
    let typed = null, mirrorSeen = 0;
    const keypad = (g, padObj, open, digits) => {
      const m = goTo(padObj.standAt.x, padObj.standAt.z, 0.6); if (m) return m;
      if (!g.modal) { open(g); typed = null; }
      else if (typed !== g.modal) { typed = g.modal; for (const d of digits) g.modal.key({ code: 'Digit' + d }); g.modal.key({ code: 'Enter' }); }
      return { wait: true, x: padObj.x, z: padObj.z };
    };
    w.botPlan = (g) => {
      const p = g.player, zone = zoneOf(p.z);
      botGlance = (zone === 'bed' || zone === 'hall') && ward.active && Math.hypot(ward.x - p.x, ward.z - p.z) < 9;
      if (g.frozen) return { wait: true, x: p.x, z: p.z - 1 };
      if (zone === 'bed') {
        if (!doorA.open) {
          const todo = [bed, desk, dresser].find((q) => !q.searched);
          if (todo) {
            const tx = todo.cx + (todo.cx < 0 ? 2.2 : -2.2), tz = todo.cz;
            if (Math.hypot(p.x - tx, p.z - tz) > 1.2) return { x: tx, z: tz };
            searchPiece(g, todo); return { wait: true, x: p.x, z: p.z };
          }
          return keypad(g, padA, useKeypadA, codeA);
        }
        if (doorA.t < 1) return { wait: true, x: 0, z: WA + 2 };
        return Math.abs(p.x) > 0.9 ? { x: 0, z: WA + 1.8 } : { x: 0, z: WA - 3 };
      }
      if (zone === 'bath') {
        if (!doorB.open) {
          if (!bathTwisted || bathLit || mirrorSeen < 1) {                       // wait for the dark, and read the mirror
            const m = goTo(0.4, -19.2, 0.7); if (m) return m;
            if (!bathLit) mirrorSeen += 1 / 60;
            return { wait: true, x: p.x, z: p.z };
          }
          return keypad(g, padB, useKeypadB, codeB);
        }
        if (doorB.t < 1) return { wait: true, x: 0, z: WB + 2 };
        return Math.abs(p.x) > 0.9 ? { x: 0, z: WB + 1.8 } : { x: 0, z: WB - 3 };
      }
      if (zone === 'hall') {
        if (!doorStairs.open) {
          if (p.z > -60) return { x: 0, z: -62 };
          return keypad(g, padC, useKeypadC, codeC);
        }
        if (doorStairs.t < 1) return { wait: true, x: STAIRS_X, z: WD + 2 };
        return Math.abs(p.x - STAIRS_X) > 0.9 ? { x: STAIRS_X, z: WD + 1.8 } : { x: STAIRS_X, z: WD - 3 };
      }
      if (p.y > 7.5 && !bonusOn) return { x: runner.x, z: runner.z };
      return null;
    };
  },
};
void wallX;
