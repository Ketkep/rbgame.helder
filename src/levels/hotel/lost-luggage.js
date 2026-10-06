import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, hotelHalo, GOLD } from './kit.js';
import { luggageCart } from './props.js';
import { openKeypad } from '../../engine/keypad.js';

// Hotel level 3 — "Lost Luggage" (Easy · Mezzanine). An escape room: you are locked in the baggage office.
// The door has a four-digit keypad. The host gives you a code. It is wrong. The real one is on the poster: count the
// suitcases by colour. One of the suitcases is a mimic. Behind the door: the baggage handling hall (conveyor belts).

const COLORS = [
  { name: 'red', hex: 0xc2332a, css: '#e0463c' },
  { name: 'blue', hex: 0x2a62c8, css: '#3b7be8' },
  { name: 'yellow', hex: 0xe6bb2c, css: '#f2c93a' },
  { name: 'green', hex: 0x2f9e5b, css: '#3cc274' },
];
const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

const WALL_Z = -8;          // the wall between the office and the handling hall
const DOOR_W = 4, DOOR_H = 4.4;
const H = 7;

export default {
  id: 'hotel-3',
  name: 'Lost Luggage',
  music: 'hotel',
  completeQuip: 'Out of a room with a door. A moving walkway. You, a hero.',

  build(w, game) {
    hotelEnv(w);
    w.spawn = { x: 0, y: 0, z: 11, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -8;
    const zN = -66;
    roomShell(w, { x0: -13, x1: 13, z0: zN, z1: 14, yb: -10, H, wallTex: 'stone', wallColor: 0xd8cdb4, pilasterEvery: 12 });
    w.plat({ x: 0, y: -9.5, z: (zN + 14) / 2, w: 26, d: 80, h: 1, tex: 'tile', color: 0x3a3f4a, roughness: 0.9 });

    // ---- the office ------------------------------------------------------------------------------
    w.plat({ x: 0, y: 0, z: (14 + WALL_Z - 0.8) / 2, w: 26, d: 14 - (WALL_Z - 0.8), h: 2, tex: 'tile', color: 0xb9c0c8, roughness: 0.45 });
    // fluorescent strips + a few real lights
    for (const z of [10, 3, -4]) for (const x of [-7, 7]) {
      w.box({ x, y: H - 0.4, z, w: 2.6, h: 0.1, d: 0.3, glow: 0xdff4ff, glowIntensity: 1.5, shadow: false });
      hotelHalo(w, x, H - 0.8, z, 4.5, 0xcfe8ff, 0.16);
    }
    w.light(0xfff0d0, 16, 26, 0, 5.4, 4);
    w.light(0xe4f0ff, 12, 22, 0, 5.4, -4);
    // the wall between the office and the handling hall, with the door gap
    const wallSeg = (x, ww) => w.plat({ x, y: H, z: WALL_Z - 0.4, w: ww, d: 0.8, h: H + 10, tex: 'stone', color: 0xd8cdb4, roughness: 0.7 });
    wallSeg(-(13 + DOOR_W / 2) / 2 - 0.0, 13 - DOOR_W / 2);
    wallSeg((13 + DOOR_W / 2) / 2, 13 - DOOR_W / 2);
    w.plat({ x: 0, y: H, z: WALL_Z - 0.4, w: DOOR_W, d: 0.8, h: H - DOOR_H, tex: 'stone', color: 0xd8cdb4, roughness: 0.7 });
    const door = w.plat({ x: 0, y: DOOR_H, z: WALL_Z - 0.4, w: DOOR_W, d: 0.5, h: DOOR_H, tex: 'metal', color: 0x8a95a6, roughness: 0.4, metalness: 0.7, radius: 0.03 });
    door.o.moving = true; door.group.matrixAutoUpdate = true;
    for (let i = 0; i < 4; i++) w.box({ x: 0, y: 0.9 + i * 1.0, z: WALL_Z + 0.02, w: DOOR_W - 0.2, h: 0.12, d: 0.08, color: 0xffd21f, shadow: false });   // hazard stripes
    w.sign({ text: 'BAGGAGE HANDLING · STAFF ONLY', x: 0, y: DOOR_H + 0.9, z: WALL_Z + 0.06, w: 6, h: 0.9, color: '#ffd21f', double: false, tw: 1024, size: 54 });

    // ---- the puzzle: count the suitcases ---------------------------------------------------------
    const order = shuffle(COLORS);
    let counts, code;
    do { counts = order.map(() => rint(2, 6)); code = counts.join(''); } while (code === '1234' || code === '1337');
    const fake = '1337';
    const slots = shuffle([[-7.2, 5.5], [7.2, 5.5], [-7.2, -1.5], [7.2, -1.5]]);
    const pallets = [];
    COLORS.forEach((col, i) => {
      const n = counts[order.indexOf(col)];
      const [px, pz] = slots[i];
      w.plat({ x: px, y: 0.16, z: pz, w: 7, d: 3.6, h: 0.16, tex: 'wood', color: 0xb08a5a, roughness: 0.8, radius: 0.02 });
      for (let k = 0; k < n; k++) {
        const cx = px - 2.4 + (k % 3) * 2.4, cz = pz - 0.7 + Math.floor(k / 3) * 1.4;
        suitcase(w, cx, cz, col.hex, 0.16);
      }
      w.sign({ text: col.name.toUpperCase(), x: px, y: 0.19, z: pz + 2.1, w: 2.4, h: 0.5, rotX: -Math.PI / 2, color: col.css, double: false, tw: 512, size: 70 });
      pallets.push({ col, n, px, pz });
    });
    // the poster on the north wall, left of the door: the colours, in order
    poster(w, order, -7.4, 2.6, WALL_Z + 0.08);
    // a couple of luggage carts for set dressing
    luggageCart(w, -11, 9, 1); luggageCart(w, 11, 9, 1);

    // ---- decoys, the ledger (host lies) and the mimic --------------------------------------------
    const junk = ['a single sock', 'a rubber duck', 'forty-two keys (none fit)', 'a sandwich of unclear age', 'a tiny hat for a tiny dog', 'a laminated apology', 'six spoons. Only spoons.'];
    const openJunk = (g) => { g.ui.toast('Inside: ' + junk[Math.floor(Math.random() * junk.length)], 'gold'); g.audio.click(); g.say('hotel.l3.junk', { priority: 1 }); };
    const decoy = (x, z, color) => {
      suitcase(w, x, z, color, 0, 1.15);
      w.interactable({ x, y: 0.4, z, w: 1.2, h: 0.8, d: 0.6, label: 'Open suitcase', onUse: openJunk });
    };
    decoy(-11.4, 12.2, 0x44434a); decoy(11.4, 12.2, 0x5a5560); decoy(-11.4, -6.4, 0x3e3a46); decoy(8.4, -6.9, 0x4c5260);
    // the mimic, right by the door where the desperate go
    const mimic = suitcase(w, -3.6, -6.8, 0x111114, 0, 1.25);
    void mimic;
    w.interactable({ x: -3.6, y: 0.45, z: -6.8, w: 1.4, h: 0.9, d: 0.7, label: 'Open suitcase', onUse: (g) => { g.say('hotel.l3.mimic', { priority: 2 }); g.audio.buzzer(); g.kill('mimic'); } });
    // the ledger on the desk
    w.plat({ x: 11.3, y: 1.0, z: -5.2, w: 2.6, d: 1.3, h: 0.14, tex: 'wood', color: 0xc9a56e, roughness: 0.5, radius: 0.04 });
    w.plat({ x: 11.3, y: 0.5, z: -5.2, w: 2.4, d: 1.1, h: 0.9, tex: 'wood', color: 0x8c6a3e, roughness: 0.6, radius: 0.04 });
    w.box({ x: 11.3, y: 1.1, z: -5.2, w: 0.9, h: 0.08, d: 0.65, color: 0x7a1f2a, rough: 0.7 });
    w.interactable({ x: 11.3, y: 1.15, z: -5.2, w: 1.1, h: 0.4, d: 0.8, label: 'Read the ledger', onUse: (g) => g.say('hotel.l3.ledger', { priority: 1, vars: { fake } }) });

    // ---- the keypad ------------------------------------------------------------------------------
    let doorOpen = false, attempts = 0, doorT = 0;
    const KX = 3.7, KZ = WALL_Z + 0.1;
    w.box({ x: KX, y: 1.4, z: KZ, w: 0.62, h: 0.9, d: 0.14, color: 0x1c2028, metal: 0.4, rough: 0.4 });
    const led = w.box({ x: KX, y: 1.7, z: KZ + 0.08, w: 0.44, h: 0.16, d: 0.02, glow: 0xff3a46, glowIntensity: 1.6, shadow: false, static: false });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) w.box({ x: KX - 0.16 + c * 0.16, y: 1.5 - r * 0.15, z: KZ + 0.08, w: 0.1, h: 0.1, d: 0.02, color: 0xcfd6e0, shadow: false });
    const keypadIt = w.interactable({ x: KX, y: 1.4, z: KZ + 0.3, w: 0.9, h: 1.1, d: 0.6, label: () => (doorOpen ? 'Door unlocked' : 'Use keypad'), enabled: null, onUse: (g) => { if (!doorOpen) useKeypad(g); } });
    void keypadIt;
    const openDoor = (g) => {
      doorOpen = true; g.audio.door();
      led.material = glowMaterial(0x40ff88, 1.6);
      w.after(0.5, () => g.say('hotel.l3.granted', { priority: 2 }));
    };
    const useKeypad = (g) => {
      openKeypad(g, {
        title: 'BAGGAGE DOOR · ENTER CODE', digits: 4,
        onSubmit: (c, api) => {
          if (c === code) {
            api.setMsg('ACCESS GRANTED', 'good'); g.audio.confirm();
            setTimeout(() => { api.close(); openDoor(g); }, 700);
          } else {
            attempts++; g.audio.buzzer(); api.clear();
            api.setMsg('ACCESS DENIED', 'bad');
            if (c === fake) g.say('hotel.l3.fake', { priority: 2, vars: { fake } });
            else if (attempts % 3 === 0) { g.say('hotel.l3.lock', { priority: 2 }); api.lockout(6); }
            else g.say('hotel.l3.denied', { priority: 1 });
          }
        },
      });
    };

    // the door slides up
    w.onUpdate((dt) => {
      if (!doorOpen || doorT >= 1) return;
      doorT = Math.min(1, doorT + dt * 0.9);
      door.setPos(0, DOOR_H / 2 + doorT * (DOOR_H + 0.3), WALL_Z - 0.4);
      if (doorT >= 1) door.setEnabled(false);
    });
    w.onRespawn(() => { /* the door stays open once unlocked */ });

    // ---- the baggage handling hall -----------------------------------------------------------------
    const path = (p) => { p.o.path = true; return p; };
    const stripe = (x, z, ww, dd, y) => w.box({ x, y: y + 0.01, z, w: ww, h: 0.04, d: 0.18, color: 0xffd21f, shadow: false }) && w.box({ x, y: y + 0.01, z: z + dd, w: ww, h: 0.04, d: 0.18, color: 0xffd21f, shadow: false });
    const pad = (z0, z1, ww = 7) => {   // a static stand-on platform spanning z0 (south) .. z1 (north)
      const p = path(w.plat({ x: 0, y: 0, z: (z0 + z1) / 2, w: ww, d: Math.abs(z0 - z1), h: 1.2, tex: 'tile', color: 0xaab2bc, roughness: 0.5, radius: 0.04 }));
      stripe(0, z1 + 0.1, ww - 0.4, Math.abs(z0 - z1) - 0.2, 0);
      return p;
    };
    const belt = (z0, z1, vz, ww = 6) => {
      const p = path(w.plat({ x: 0, y: 0, z: (z0 + z1) / 2, w: ww, d: Math.abs(z0 - z1), h: 0.9, tex: 'metal', color: 0x4a5160, roughness: 0.5, metalness: 0.5, radius: 0.03 }));
      w.conveyor(p, { vz });
      for (const sx of [-1, 1]) w.box({ x: sx * (ww / 2 + 0.12), y: 0.12, z: (z0 + z1) / 2, w: 0.24, h: 0.5, d: Math.abs(z0 - z1), color: GOLD, metal: 1, rough: 0.35, shadow: false });
      return p;
    };
    const E = pad(WALL_Z - 0.8, -13.4, 9);
    const A = belt(-15.2, -24.2, +2.8);
    const P1 = pad(-26, -29);
    const B = belt(-31, -42, -3.4);
    const P2 = pad(-44.6, -47.1);
    const C = belt(-49, -53, +4.6);
    const G = pad(-55, -61, 10);
    void E; void A; void B; void C;
    w.checkpoint({ x: 0, y: 0, z: -27.5, real: true });
    // the press over belt B
    const press = w.hazard({ x: 0, y: 3.2, z: -36.5, w: 6.2, h: 1.1, d: 2.2, color: 0xff3a4a, move: (t) => ({ y: -2.3 * Math.max(0, Math.sin(t * 1.6) * 1.4 - 0.4) }) });
    void press;
    for (const sx of [-1, 1]) w.box({ x: sx * 3.4, y: 3.9, z: -36.5, w: 0.4, h: 7, d: 0.4, color: 0x5a6070, metal: 0.7, rough: 0.4 });
    w.box({ x: 0, y: 6.6, z: -36.5, w: 7.4, h: 0.6, d: 0.7, color: 0x5a6070, metal: 0.7, rough: 0.4 });
    // strip lights down the hall
    for (let z = -16; z > -60; z -= 7) { w.box({ x: 0, y: H - 0.4, z, w: 3.4, h: 0.1, d: 0.3, glow: 0xdff4ff, glowIntensity: 1.4, shadow: false }); hotelHalo(w, 0, H - 0.9, z, 5.5, 0xcfe8ff, 0.14); }
    w.light(0xfff0d0, 14, 26, 0, 5.5, -21); w.light(0xfff0d0, 14, 26, 0, 5.5, -40);
    w.sign({ text: 'CAROUSEL 13', x: 0, y: 4.2, z: -61.7, w: 8, h: 1.6, color: '#ffd21f', double: false, tw: 1024, size: 130 });
    w.goal({ x: 0, y: 0, z: -58, color: GOLD, onReach: () => { game.say('hotel.l3.done', { priority: 2 }); game.completeLevel(); } });

    // ---- the host -----------------------------------------------------------------------------------
    let t0 = 0, intro = false, nearPress = false, onBelt = false;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l3.intro'); g.say('hotel.l3.intro2', { vars: { fake } }); }
      const p = g.player;
      if (!onBelt && p.z < -15 && p.z > -25) { onBelt = true; g.say('hotel.l3.belt'); }
      if (!nearPress && p.z < -31 && p.z > -42) { nearPress = true; g.say('hotel.l3.press'); }
    };
    w.hooks.onDeath = () => false;

    // ---- hint: 3 clue levels, then the usual dotted trail --------------------------------------------
    let hintN = 0;
    w.hintAction = (g) => {
      if (doorOpen) return 'trail';
      hintN++;
      if (hintN === 1) g.say('hotel.l3.hint1', { priority: 1 });
      else if (hintN === 2) g.say('hotel.l3.hint2', { priority: 1, vars: { a: code[0], b: code[1] } });
      else g.say('hotel.l3.hint3', { priority: 1, vars: { code } });
      return true;
    };

    // test hooks + bot
    w.escape = { get code() { return code; }, fake, get doorOpen() { return doorOpen; }, pallets, order, useKeypad, openDoor };
    w.botPlan = (g) => {
      const p = g.player;
      if (!doorOpen) {
        if (Math.hypot(p.x - KX, p.z - (KZ + 1.2)) > 1.2) return { x: KX, z: KZ + 1.2 };
        if (!g.modal) useKeypad(g);
        else { for (const d of code) g.modal.key({ code: 'Digit' + d }); g.modal.key({ code: 'Enter' }); }
        return { wait: true, x: p.x, z: p.z };
      }
      if (doorT < 1 && p.z > WALL_Z - 0.2) return { wait: true, x: p.x, z: p.z };
      if (p.z > WALL_Z + 0.4 && Math.abs(p.x) > 0.9) return { x: 0, z: WALL_Z + 1.6 };   // line up with the doorway first
      return null;
    };
  },
};

// a suitcase: a leather slab with a handle and two brass latches. `y` = surface it stands on.
function suitcase(w, x, z, color, y = 0, s = 1) {
  const body = w.plat({ x, y: y + 0.62 * s, z, w: 0.95 * s, d: 0.55 * s, h: 0.62 * s, tex: 'leather', color, roughness: 0.55, radius: 0.08 });
  w.box({ x, y: y + 0.62 * s + 0.05, z: z + 0.28 * s, w: 0.3 * s, h: 0.06, d: 0.04, color: 0x1a1a1a, rough: 0.5, shadow: false });
  for (const sx of [-1, 1]) w.box({ x: x + sx * 0.28 * s, y: y + 0.4 * s, z: z + 0.28 * s, w: 0.1 * s, h: 0.1 * s, d: 0.03, color: GOLD, metal: 1, rough: 0.3, shadow: false });
  w.box({ x, y: y + 0.32 * s, z: z + 0.28 * s, w: 0.95 * s, h: 0.05, d: 0.02, color: 0x000000, rough: 0.8, shadow: false });
  return body;
}

// "LOST & FOUND · CLAIM CODE" with four coloured dots, in the order the digits go
function poster(w, order, x, y, z) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#f3e9d2'; g.fillRect(0, 0, 768, 512);
  g.strokeStyle = '#7a5a1c'; g.lineWidth = 10; g.strokeRect(14, 14, 740, 484);
  g.fillStyle = '#7a1f2a'; g.textAlign = 'center';
  g.font = '64px "Archivo Black", Impact, sans-serif'; g.fillText('LOST & FOUND', 384, 100);
  g.fillStyle = '#2a2430'; g.font = '34px "Archivo Black", Impact, sans-serif';
  g.fillText('CLAIM CODE = HOW MANY', 384, 160);
  g.font = '28px "Archivo Black", Impact, sans-serif'; g.fillText('CASES OF EACH COLOUR, IN ORDER:', 384, 200);
  order.forEach((col, i) => {
    const cx = 130 + i * 168;
    g.fillStyle = col.css; g.beginPath(); g.arc(cx, 320, 54, 0, 7); g.fill();
    g.strokeStyle = '#2a2430'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#2a2430'; g.font = '40px "Archivo Black", Impact, sans-serif'; g.fillText(`${i + 1}`, cx, 424);
  });
  g.fillStyle = '#7a5a1c'; g.font = '22px "Archivo Black", Impact, sans-serif'; g.fillText('(the host says it is 1337. the host says a lot)', 384, 474);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  w.ownTextures.push(tex);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.8), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.position.set(x, y, z);
  w.add(m);
  w.box({ x, y, z: z - 0.06, w: 4.5, h: 3.1, d: 0.06, color: GOLD, metal: 1, rough: 0.35, shadow: false });
  void plainMaterial;
}
