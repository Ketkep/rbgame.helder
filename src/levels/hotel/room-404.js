import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { roomShell, hotelHalo, GOLD } from './kit.js';
import { openKeypad } from '../../engine/keypad.js';
import { inView } from '../../engine/view.js';

// Hotel level 11 — "Room 404" (Hard · Guest Rooms). Your room. The door is locked (3-digit keypad). The digits are hidden in the
// furniture. The furniture does not like being watched: it moves when you are not looking. One of the wardrobes — there is only
// one, it is the problem — also walks toward you, but only when you are not looking at it. And sometimes the lights go out.

const H = 5.4;
const X0 = -9.5, X1 = 9.5, Z0 = -13, Z1 = 9;
const SLOTS = [[-6.6, -9.0], [-6.6, -2.0], [-6.6, 5.0], [6.6, -9.0], [6.6, -2.0], [6.6, 5.0]];
const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const wood = (c = 0x6a4a2a) => plainMaterial(c, { roughness: 0.55 });

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
    roomShell(w, { x0: X0 - 0.5, x1: X1 + 0.5, z0: -27, z1: Z1 + 1, yb: -6, H, wallTex: 'panel', wallColor: 0xc8b8a8, pilasterEvery: 40, lamps: false, beamEvery: 30 });
    w.plat({ x: 0, y: 0, z: (Z1 + 1 + Z0) / 2 + 0.0, w: 20, d: Z1 + 1 - Z0, h: 2, tex: 'carpet', color: 0x6f7fa0, roughness: 0.95 });
    // the partition with the door
    const D_W = 3.4, D_H = 3.3, WALL_Z = Z0;
    const seg = (x, ww) => w.plat({ x, y: H, z: WALL_Z - 0.4, w: ww, d: 0.8, h: H + 6, tex: 'panel', color: 0xc8b8a8, roughness: 0.7 });
    seg(-(X1 + 0.5 + D_W / 2) / 2, X1 + 0.5 - D_W / 2); seg((X1 + 0.5 + D_W / 2) / 2, X1 + 0.5 - D_W / 2);
    w.plat({ x: 0, y: H, z: WALL_Z - 0.4, w: D_W, d: 0.8, h: H - D_H, tex: 'panel', color: 0xc8b8a8, roughness: 0.7 });
    const door = w.plat({ x: 0, y: D_H, z: WALL_Z - 0.4, w: D_W, d: 0.5, h: D_H, tex: 'wood', color: 0x5a3a24, roughness: 0.5, radius: 0.03 });
    door.o.moving = true; door.group.matrixAutoUpdate = true;
    w.sign({ text: '404', x: 0, y: D_H + 0.75, z: WALL_Z + 0.06, w: 1.8, h: 0.8, color: '#d8a94a', double: false, tw: 256, size: 130 });
    // the hallway on the other side
    w.plat({ x: 0, y: 0, z: (Z0 - 0.8 - 27) / 2, w: 20, d: 27 - Z0 - 0.8 + 0.0, h: 2, tex: 'carpet', color: 0x7a2030, roughness: 0.95 }).o.path = true;
    w.light(0xffe0b0, 12, 18, 0, 4.4, 2); w.light(0xffd0a0, 8, 12, 0, 4.2, -8); w.light(0xffd0a0, 8, 12, 0, 4.2, -19);
    w.light(0xffa860, 7, 9, -6, 1.8, 6);
    // a couple of wall decorations: a painting and a window with the curtains drawn
    w.box({ x: 0, y: 3.0, z: Z1 + 0.35, w: 3.2, h: 1.8, d: 0.08, color: 0x2a3a5a, rough: 0.5, shadow: false });
    w.box({ x: 0, y: 3.0, z: Z1 + 0.3, w: 3.5, h: 2.1, d: 0.06, color: GOLD, metal: 1, rough: 0.4, shadow: false });

    // ---- the keypad on the wall next to the door ------------------------------------------------------------------------
    const code = String(Math.floor(Math.random() * 900) + 100).replace(/404/, '405');
    const fake = '404';
    const KX = 3.1, KZ = WALL_Z + 0.1;
    w.box({ x: KX, y: 1.4, z: KZ, w: 0.6, h: 0.9, d: 0.14, color: 0x1c2028, metal: 0.4, rough: 0.4 });
    const led = w.box({ x: KX, y: 1.7, z: KZ + 0.08, w: 0.44, h: 0.16, d: 0.02, glow: 0xff3a46, glowIntensity: 1.6, shadow: false, static: false });
    let doorOpen = false, doorT = 0, attempts = 0;
    const found = [null, null, null];
    const names = ['bed', 'desk', 'dresser'];
    const digitsAt = shuffle([0, 1, 2]);   // digit index held by bed, desk, dresser
    const useKeypad = (g) => openKeypad(g, {
      title: 'ROOM 404 · ENTER CODE', digits: 3,
      info: () => 'Notes — ' + found.map((d, i) => `Digit ${i + 1}: ${d === null ? '?' : d}`).join(' · '),
      onSubmit: (c, api) => {
        if (c === code) { api.setMsg('UNLOCKED', 'good'); g.audio.confirm(); setTimeout(() => { api.close(); doorOpen = true; g.audio.door(); led.material = glowMaterial(0x40ff88, 1.6); w.after(0.5, () => g.say('hotel.l11.open', { priority: 2 })); }, 600); }
        else {
          attempts++; g.audio.buzzer(); api.clear(); api.setMsg('WRONG', 'bad');
          if (c === fake) g.say('hotel.l11.fake', { priority: 2 });
          else if (attempts % 3 === 0) { g.say('hotel.l11.lock', { priority: 2 }); api.lockout(8); }
          else g.say('hotel.l11.denied', { priority: 1 });
        }
      },
    });
    w.interactable({ x: KX, y: 1.4, z: KZ + 0.3, w: 0.9, h: 1.1, d: 0.6, label: () => (doorOpen ? 'Unlocked' : 'Use keypad'), onUse: (g) => { if (!doorOpen) useKeypad(g); } });
    w.onUpdate((dt) => {
      if (!doorOpen || doorT >= 1) return;
      doorT = Math.min(1, doorT + dt * 0.9);
      door.setPos(0, D_H / 2 + doorT * (D_H + 0.3), WALL_Z - 0.4);
      if (doorT >= 1) door.setEnabled(false);
    });
    w.goal({ x: 0, y: 0, z: -21, color: GOLD, onReach: () => { game.say('hotel.l11.done', { priority: 2 }); game.completeLevel(); } });
    w.sign({ text: 'EXIT STAIRS →', x: 0, y: 3.4, z: -25.6, w: 5, h: 0.8, color: '#6cf0b2', double: false, tw: 512, size: 70, glow: true });

    // ---- the furniture (it moves when you do not look) ----------------------------------------------------------------------
    const pieces = [];
    const makePiece = (name, kind, dims) => {
      const [fw, fd, top] = dims;
      const pl = w.plat({ x: 0, y: top, z: 0, w: fw, d: fd, h: top, tex: kind.tex, color: kind.color, roughness: 0.6, radius: 0.06 });
      pl.o.moving = true; pl.group.matrixAutoUpdate = true;
      const extra = new THREE.Group(); pl.group.add(extra);   // decorations ride along
      return { name, pl, fw, fd, top, extra, slot: -1, unseen: 0, dig: -1, searched: false, it: null, cx: 0, cz: 0 };
    };
    const bed = makePiece('bed', { tex: 'leather', color: 0x4a2a3a }, [3.0, 2.2, 0.7]);
    { const pillow = (x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.5), plainMaterial(0xf4f0e8, { roughness: 0.8 })); m.position.set(x, 0.4, -0.7); bed.extra.add(m); }; pillow(-0.7); pillow(0.7); const blanket = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 1.4), plainMaterial(0x7a2a3a, { roughness: 0.9 })); blanket.position.set(0, 0.1, 0.4); bed.extra.add(blanket); const head = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.2, 0.15), wood(0x4a2a18)); head.position.set(0, 0.45, -1.15); bed.extra.add(head); }
    const desk = makePiece('desk', { tex: 'wood', color: 0xb08a5a }, [2.4, 1.1, 0.95]);
    { const tv = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.1), plainMaterial(0x0c0c10, { roughness: 0.2 })); tv.position.set(0, 0.7, -0.2); desk.extra.add(tv); const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), glowMaterial(0x203a50, 0.8)); scr.position.set(0, 0.7, -0.14); desk.extra.add(scr); const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.4, 10), glowMaterial(0xffd890, 1.4)); lamp.position.set(0.9, 0.7, 0.1); desk.extra.add(lamp); }
    const dresser = makePiece('dresser', { tex: 'wood', color: 0x8a6a42 }, [2.0, 0.9, 1.15]);
    { for (let k = 0; k < 3; k++) { const kn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); kn.position.set(-0.5 + k * 0.5, 0.1, 0.46); dresser.extra.add(kn); } const mirror = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.06), plainMaterial(0xcfd8e4, { metalness: 1, roughness: 0.05 })); mirror.position.set(0, 1.0, -0.4); dresser.extra.add(mirror); }
    const chair = makePiece('armchair', { tex: 'leather', color: 0x2a4a3a }, [1.3, 1.3, 0.8]);
    { const back = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 0.25), plainMaterial(0x2a4a3a, { roughness: 0.7 })); back.position.set(0, 0.6, -0.55); chair.extra.add(back); }
    pieces.push(bed, desk, dresser, chair);
    // assign digits: bed/desk/dresser hold the digits, the armchair holds the host's lie
    [bed, desk, dresser].forEach((p, i) => { p.dig = digitsAt[i]; });
    chair.dig = -1;
    // initial slots
    const slotOrder = shuffle([0, 1, 2, 3, 4, 5]);
    const slotOwner = Array(6).fill(null);
    const place = (p, si) => {
      if (p.slot >= 0) slotOwner[p.slot] = null;
      p.slot = si; slotOwner[si] = p;
      const [sx, sz] = SLOTS[si]; p.cx = sx; p.cz = sz;
      p.pl.setPos(sx, p.top - p.pl.o.h / 2, sz);
      const rot = sx < 0 ? Math.PI / 2 : -Math.PI / 2;   // face the middle of the room (pieces are axis-aligned boxes, so only the dressing rotates)
      void rot;
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
      if (doorOpen) return;
      g.audio.click();
      if (p === chair) {
        p.searched = true;
        g.ui.toast('A note: “The code is 404.” — H.', 'gold'); g.say('hotel.l11.note', { priority: 2 }); return;
      }
      const di = p.dig;
      const was = found[di] !== null;
      found[di] = Number(code[di]); p.searched = true;
      g.ui.toast(`Digit ${di + 1} = ${code[di]}  (${p.name})`, 'gold');
      g.audio.confirm();
      if (!was) { const n = found.filter((d) => d !== null).length; g.say(n === 3 ? 'hotel.l11.all' : n === 1 ? 'hotel.l11.first' : 'hotel.l11.second', { priority: 1 }); }
    }

    // ---- the wardrobe ---------------------------------------------------------------------------------------------------
    const ward = { x: 6.6, z: -9.0, speed: 2.1, moving: false, active: false, eyes: null, seenT: 0 };
    ward.x = SLOTS[slotOrder[4]][0]; ward.z = SLOTS[slotOrder[4]][1];
    const wardPl = w.plat({ x: ward.x, y: 2.4, z: ward.z, w: 1.7, d: 1.0, h: 2.4, tex: 'wood', color: 0x3a2412, roughness: 0.5, radius: 0.05 });
    wardPl.o.moving = true; wardPl.group.matrixAutoUpdate = true;
    for (const sx of [-1, 1]) { const handle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); handle.position.set(sx * 0.1, 0.1, 0.52); wardPl.group.add(handle); }
    const door1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.0, 0.02), plainMaterial(0x120a04)); door1.position.set(0, 0, 0.51); wardPl.group.add(door1);
    const eyeMat = glowMaterial(0xffd23f, 2.4);
    const eyes = [-0.3, 0.3].map((ex) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeMat); e.position.set(ex, 0.65, 0.52); e.visible = false; wardPl.group.add(e); return e; });
    ward.eyes = eyes;
    const setWard = () => wardPl.setPos(ward.x, 1.2, ward.z);
    setWard();
    const WARD_START = 14;
    let dark = false, darkUntil = 0, nextDark = 22, warnDark = false, tLevel = 0;
    const resetWard = () => { ward.x = SLOTS[slotOrder[4]][0]; ward.z = SLOTS[slotOrder[4]][1]; ward.active = false; ward.seenT = 0; setWard(); tLevel = 0; };
    // keep the wardrobe off the keypad lane
    const clampW = () => { ward.x = Math.max(X0 + 1.1, Math.min(X1 - 1.1, ward.x)); ward.z = Math.max(Z0 + 1.0, Math.min(Z1 - 1.0, ward.z)); };
    const fade = game.ui.el.fade;
    const setDark = (a, ms = 200) => { fade.style.transition = `opacity ${ms}ms`; fade.style.opacity = String(a); };
    w.onDispose(() => { fade.style.transition = ''; fade.style.opacity = '0'; });
    w.onRespawn(() => { resetWard(); dark = false; setDark(0, 100); nextDark = tLevel + 22; });

    const observed = (x, y, z, margin) => !dark && inView(game, x, y, z, margin);
    w.onUpdate((dt) => {
      if (game.state !== 'playing') return;
      tLevel += dt;
      const p = game.player;
      // ---- lights out ----------------------------------------------------------------------------------------------
      if (!dark && tLevel > nextDark - 1.3 && !warnDark) { warnDark = true; game.audio.glitch(); }
      if (warnDark && !dark) { setDark(Math.floor(tLevel * 14) % 2 ? 0.55 : 0.0, 60); if (tLevel > nextDark) { dark = true; darkUntil = tLevel + 2.6; setDark(0.93, 120); game.say('hotel.l11.dark', { priority: 1 }); } }
      if (dark && tLevel > darkUntil) { dark = false; warnDark = false; setDark(0, 300); nextDark = tLevel + 20 + Math.random() * 8; }
      // ---- the furniture moves when unseen -------------------------------------------------------------------------
      for (const pc of pieces) {
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
      // ---- the wardrobe: frozen while watched, walks when not -----------------------------------------------------
      if (!ward.active && tLevel > WARD_START) { ward.active = true; game.say('hotel.l11.ward', { priority: 1 }); }
      const watched = observed(ward.x, 1.3, ward.z, 0.3);
      ward.moving = ward.active && !watched;
      for (const e of eyes) e.visible = ward.moving;
      if (ward.moving) {
        const dx = p.x - ward.x, dz = p.z - ward.z, d = Math.hypot(dx, dz) || 1;
        const sp = ward.speed * (game.baby ? 0.7 : 1) * (dark ? 1.15 : 1);
        ward.x += (dx / d) * sp * dt; ward.z += (dz / d) * sp * dt; clampW(); setWard();
        if (Math.hypot(ward.x - p.x, ward.z - p.z) < 1.35 && Math.abs(p.y) < 2.4) { game.say('hotel.l11.caught', { priority: 2 }); game.kill('wardrobe'); }
        if (!stepSaid && d < 6) { stepSaid = true; game.say('hotel.l11.close', { priority: 1 }); }
      }
      if (d3(ward, p) > 9) stepSaid = false;
    });
    let movedSaid = false, stepSaid = false;
    const d3 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

    // ---- the host ------------------------------------------------------------------------------------------------------------
    let t0 = 0, intro = false;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l11.intro'); g.say('hotel.l11.intro2'); }
    };
    w.hooks.onDeath = () => false;
    let hintN = 0;
    w.hintAction = (g) => {
      if (doorOpen) return 'trail';
      hintN++;
      if (hintN === 1) g.say('hotel.l11.hint1', { priority: 1 });
      else if (hintN === 2) g.say('hotel.l11.hint2', { priority: 1 });
      else g.say('hotel.l11.hint3', { priority: 1, vars: { code } });
      return true;
    };
    w.room404 = { pieces, ward, code, fake, found, get doorOpen() { return doorOpen; }, get dark() { return dark; }, get tLevel() { return tLevel; }, search: (p) => searchPiece(game, p), useKeypad: () => useKeypad(game), setDark: (v) => { dark = v; if (v) darkUntil = tLevel + 5; }, slots: SLOTS };
    w.botPlan = (g) => {
      const p = g.player;
      if (!doorOpen) {
        const todo = [bed, desk, dresser].find((q) => !q.searched);
        if (todo) {
          const tx = todo.cx + (todo.cx < 0 ? 2.2 : -2.2), tz = todo.cz;
          if (Math.hypot(p.x - tx, p.z - tz) > 1.2) return { x: tx, z: tz };
          searchPiece(g, todo); return { wait: true, x: p.x, z: p.z };
        }
        if (Math.hypot(p.x - KX, p.z - (KZ + 1.2)) > 1.2) return { x: KX, z: KZ + 1.2 };
        if (!g.modal) useKeypad(g); else { for (const d of code) g.modal.key({ code: 'Digit' + d }); g.modal.key({ code: 'Enter' }); }
        return { wait: true, x: p.x, z: p.z };
      }
      if (doorT < 1) return { wait: true, x: p.x, z: p.z };
      if (p.z > WALL_Z + 0.4 && Math.abs(p.x) > 0.9) return { x: 0, z: WALL_Z + 1.6 };
      return null;
    };
    void hotelHalo;
  },
};
