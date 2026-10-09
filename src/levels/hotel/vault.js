import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, GOLD } from './kit.js';
import { canvasPlane, keypadBox, shuffle } from './escape-kit.js';
import { openKeypad } from '../../engine/keypad.js';
import { onPlat } from '../common.js';
import { trollCheckpoint, fakeExit, evasiveGoal, fakeComplete, crash, stageTitle, stageHint } from './trolls.js';

// Hotel level 17 — "The Vault" (Impossible · Penthouse). FIRST FULL PASS. Lasers, a code you have to count, three plates you
// have to keep lit, and a vault floor with a very convincing alarm exit. Four stages, a checkpoint each.
//   1 Laser Hall   blinking walls (the emitters glow before they fire) and low sweepers (hop them)
//   2 The Combination  three panels of lit lamps: the code is how many are lit on each. The host says 4-0-4.
//   3 Timing Locks three plates, each stays lit for 6 s: light all three and the gate opens
//   4 The Vault   a laser grid, a fake alarm exit, a gold bar that runs away twice, a fake LEVEL COMPLETE

const NAMES = ['Laser Hall', 'The Combination', 'Timing Locks', 'The Vault'];
const Z1 = 18, Z0 = -152;

export default {
  id: 'hotel-17',
  name: 'The Vault',
  music: 'hotel',
  completeQuip: 'You robbed the hotel. The hotel was robbing you anyway. We call it even. We do not.',

  build(w, game) {
    hotelEnv(w);
    w.killY = -30;
    roomShell(w, { x0: -12, x1: 12, z0: Z0, z1: Z1, yb: -10, H: 12, wallTex: 'metal', wallColor: 0x8a95a6, pilasterEvery: 16, lamps: false });
    w.plat({ x: 0, y: 0, z: (Z0 + Z1) / 2, w: 24, d: Z1 - Z0, h: 1.2, tex: 'metal', color: 0x4a5160, roughness: 0.4, path: true });
    w.spawn = { x: 0, y: 0, z: 13, yaw: 0 }; w.respawn = { ...w.spawn };
    const stages = [{ at: { x: 0, y: 0, z: 13 } }, { at: { x: 0, y: 0, z: -34 } }, { at: { x: 0, y: 0, z: -62 } }, { at: { x: 0, y: 0, z: -104 } }];
    const cps = new Map();
    const cp = (i, z) => { cps.set(w.checkpoint({ x: 0, y: 0, z, real: true }), i); };
    const red = new THREE.PointLight(0xff3a46, 0.0); void red;
    const RED = 0xff3a46;

    // ---- lasers -----------------------------------------------------------------------------------------------------------
    const lasers = [];
    // a wall of light across the room that blinks: on for `on` s every `P` s; the emitters glow white for 0.7 s before it fires
    const blinker = (z, P, on, ph = 0, h = 2.6) => {
      const hz = w.hazard({ x: 0, y: h / 2, z, w: 23.4, h, d: 0.25, color: RED });
      const line = w.box({ x: 0, y: 0.9, z, w: 23.4, h: 0.04, d: 0.04, glow: RED, glowIntensity: 0.6, shadow: false, static: false });
      const post = [-1, 1].map((s) => w.box({ x: s * 11.6, y: 1.0, z, w: 0.5, h: 2.0, d: 0.5, color: 0x23262e, metal: 0.8, shadow: false }));
      void post;
      const isOn = (t) => ((t + ph) % P) < on;
      const warn = (t) => !isOn(t) && ((t + ph + 0.7) % P) < on;
      hz.predict = isOn;
      w.onUpdate((dt, t) => { const o = isOn(t); hz.enabled = o; hz.group.visible = o; line.scale.y = 1; line.material.opacity = 1; line.visible = !o; line.material = warn(t) ? WARN : DIM; });
      lasers.push(hz); return hz;
    };
    const DIM = glowMaterial(RED, 0.5, 0.5), WARN = glowMaterial(0xffffff, 2.2);
    // a low beam that sweeps along z: hop it
    const sweeper = (z, amp, sp, ph = 0) => {
      const hz = w.hazard({ x: 0, y: 0.45, z, w: 23.4, h: 0.5, d: 0.25, color: RED, move: (t) => ({ z: amp * Math.sin(t * sp + ph) }) });
      hz.jumpable = true; lasers.push(hz); return hz;
    };

    // ===== 1 · laser hall
    blinker(4, 4.2, 1.5, 0); sweeper(-3, 2.2, 1.0); blinker(-9, 4.6, 1.6, 1.3); sweeper(-14, 2.0, 1.2, 1); blinker(-19, 5.0, 1.6, 2.2); sweeper(-24, 2.4, 1.1, 2); blinker(-28.5, 4.4, 1.5, 0.6);
    w.sign({ text: 'VAULT LEVEL · LASERS ACTIVE', x: 0, y: 5, z: 17.4, w: 9, h: 1.1, color: '#ff8a8a', double: false, tw: 1024, size: 70, glow: true });
    cp(1, -33.5);

    // ===== 2 · the combination
    const digits = [1 + Math.floor(Math.random() * 9), 1 + Math.floor(Math.random() * 9), 1 + Math.floor(Math.random() * 9)];
    const code = digits.join('');
    digits.forEach((n, i) => {
      const z = -39 - i * 6.2;
      const lit = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, n);
      canvasPlane(w, { x: -11.55, y: 2.6, z, width: 3.6, height: 3.6, rotY: Math.PI / 2, px: 256, glow: 1.0,
        draw: (g, W, H) => { g.fillStyle = '#0c1118'; g.fillRect(0, 0, W, H); g.strokeStyle = '#ffd9a0'; g.lineWidth = 6; g.strokeRect(8, 8, W - 16, H - 16);
          for (let k = 0; k < 9; k++) { const cx = W * (0.25 + 0.25 * (k % 3)), cy = H * (0.25 + 0.25 * Math.floor(k / 3)); g.beginPath(); g.arc(cx, cy, W * 0.07, 0, Math.PI * 2); g.fillStyle = lit.includes(k) ? '#ffe9a8' : '#1c2430'; g.fill(); } } });
      w.sign({ text: 'BOX ' + 'ABC'[i], x: -11.5, y: 4.7, z, w: 2, h: 0.5, rotY: Math.PI / 2, color: '#ffd9a0', double: false, tw: 256, size: 60 });
    });
    w.sign({ text: 'COUNT THE LAMPS. A · B · C', x: 0, y: 5.5, z: -36.5, w: 9, h: 0.9, color: '#ffd9a0', double: false, tw: 1024, size: 60, glow: true });
    // the vault door
    for (const sx of [-1, 1]) w.plat({ x: sx * 7.5, y: 12, z: -58, w: 9, d: 1.2, h: 12, tex: 'metal', color: 0x6b7587, roughness: 0.35 });
    w.plat({ x: 0, y: 12, z: -58, w: 6, d: 1.2, h: 7, tex: 'metal', color: 0x6b7587, roughness: 0.35 });
    const gap = w.collider({ x: 0, y: 2.5, z: -58, w: 6, h: 5, d: 1.0 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 1.0), plainMaterial(0x9aa3b4, { metalness: 0.9, roughness: 0.3 })); slab.position.set(0, 2.5, -58); w.add(slab);
    w.sign({ text: 'VAULT', x: 0, y: 5.4, z: -57.35, w: 4, h: 0.9, color: '#ffd9a0', double: false, tw: 512, size: 90 });
    let opened = false, wrong = 0;
    const openDoor = () => { if (opened) return; opened = true; gap.enabled = false; slab.visible = false; game.audio.chime(); game.ui.toast('✔ Vault door open', 'good'); };
    const pad = keypadBox(w, game, {
      x: 5, y: 1.4, z: -57.35, face: 's', label: 'Enter the vault code',
      use: (g) => {
        if (opened) return;
        openKeypad(g, { title: 'VAULT DOOR', digits: 3, info: 'Three digits. Count the lamps.', onSubmit: (c, api) => {
          if (c === code) { api.close(); openDoor(); game.say('hotel.l17.open', { priority: 2 }); }
          else if (c === '404') { api.setMsg('ACCESS GRANTED*', 'good'); setTimeout(() => api.setMsg('…just kidding', 'bad'), 900); game.say('hotel.l17.fake404', { priority: 2 }); api.clear(); }
          else { wrong += 1; api.setMsg('DENIED', 'bad'); api.clear(); if (wrong % 3 === 0) api.lockout(3); }
        } });
      },
    });
    void pad;
    cp(2, -62);

    // ===== 3 · timing locks: three plates, each lit for 6 s; all three at once opens the gate
    const plates = [{ x: -5, z: -68 }, { x: 5, z: -80 }, { x: -5, z: -92 }].map((p, i) => {
      const slabP = w.box({ x: p.x, y: 0.03, z: p.z, w: 3, h: 0.08, d: 3, color: 0x1d2a3a, metal: 0.5, rough: 0.4, shadow: false });
      const lamp = w.box({ x: p.x, y: 0.1, z: p.z, w: 2.4, h: 0.04, d: 2.4, glow: 0x2dd4bf, glowIntensity: 0.3, shadow: false, static: false });
      const rec = { ...p, until: -1, lamp, slabP, i };
      w.trigger({ x: p.x, y: 0.6, z: p.z, w: 2.8, h: 1.4, d: 2.8, once: false, onEnter: () => { rec.until = w.t + 6; game.audio.chime(); } });
      return rec;
    });
    const gate2 = w.collider({ x: 0, y: 2.5, z: -100, w: 24, h: 5, d: 0.8 });
    const gateVis = new THREE.Mesh(new THREE.BoxGeometry(24, 5, 0.8), plainMaterial(0x7b8597, { metalness: 0.9, roughness: 0.3 })); gateVis.position.set(0, 2.5, -100); w.add(gateVis);
    let gateOpen = false;
    sweeper(-74, 2.0, 1.1, 0.5); blinker(-86, 4.6, 1.5, 0.9);
    w.onUpdate((dt, t) => {
      let all = true;
      for (const p of plates) { const on = t < p.until; p.lamp.material = on ? LIT : OFF; if (!on) all = false; }
      if (all && !gateOpen) { gateOpen = true; gate2.enabled = false; gateVis.visible = false; game.audio.chime(); game.ui.toast('✔ Gate open', 'good'); game.say('hotel.l17.gate', { priority: 1 }); }
    });
    const LIT = glowMaterial(0x6cf0b2, 2.0), OFF = glowMaterial(0x2dd4bf, 0.3);
    w.sign({ text: 'LIGHT ALL THREE', x: 0, y: 5, z: -63.5, w: 8, h: 0.9, color: '#6cf0b2', double: false, tw: 1024, size: 62, glow: true });
    trollCheckpoint(w, game, { x: 0, y: 0, z: -103.4, mode: 'fake' });
    cp(3, -108);

    // ===== 4 · the vault floor: lasers, a fake alarm exit, a shy gold bar, a fake LEVEL COMPLETE
    blinker(-115, 4.8, 1.6, 0.2); sweeper(-120, 2.2, 1.3, 0.3); blinker(-125, 4.4, 1.5, 2.1); sweeper(-130, 2.3, 1.1, 1.7);
    fakeExit(w, game, { x: -7.2, y: 0, z: -144, kind: 'door', label: 'EXIT', say: 'hotel.l17.alarm', yaw: Math.PI / 2 });
    for (const [x, z] of [[-9, -138], [9, -138], [-9, -147], [9, -147]]) w.box({ x, y: 0.5, z, w: 2.2, h: 1.0, d: 1.2, color: GOLD, metal: 1, rough: 0.3 });
    const runner = evasiveGoal(w, game, {
      spots: [{ x: 0, y: 0, z: -146 }, { x: -6, y: 0, z: -137 }, { x: 5, y: 0, z: -143 }], radius: 5, color: GOLD, say: ['hotel.l17.hop1', 'hotel.l17.hop2'],
      onReach: () => { if (!fakeComplete(game, w, { title: 'VAULT CRACKED', say: 'hotel.l17.fakewin', then: () => { w.goalObj = real; real.group.visible = true; real.trig.enabled = true; game.say('hotel.l17.again', { priority: 2 }); } })) game.completeLevel(); },
    });
    const real = w.goal({ x: 8, y: 0, z: -149, color: GOLD, onReach: () => { game.say('hotel.l17.done', { priority: 2 }); game.completeLevel(); } });
    real.group.visible = false; real.trig.enabled = false;
    w.goalObj = runner;

    // ---- host, hint, bot -----------------------------------------------------------------------------------------------------
    w.hooks.onCheckpoint = (c) => { const i = cps.get(c); if (i !== undefined) stageTitle(game, w, i + 1, NAMES.length, NAMES[i]); };
    let t0 = 0, intro = false;
    w.hooks.frame = (dt, g) => { if (g.state !== 'playing') return; t0 += dt; if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l17.intro'); stageTitle(g, w, 1, NAMES.length, NAMES[0]); } };
    w.hooks.onDeath = () => { if (Math.random() < 0.6) { game.say('hotel.l17.zap', { priority: 1 }); return true; } return false; };
    // an honest, next-stage-only hint: stage 2 says how to read the panels, the others just show the way
    const base = (() => { stageHint(w, stages.map((s, i) => ({ at: s.at, route: [{ x: 0, y: 0, z: (stages[i + 1]?.at.z ?? -146) + 4 }] })), { end: { x: 0, y: 0, z: -146 } }); return w.hintFn; })();
    w.hintFn = base;
    w.hintAction = (g) => {
      const z = g.player.z;
      if (z < -34 && z > -58 && !opened) { g.say('hotel.l17.hint', { priority: 1, vars: { n: digits.join(', ') } }); g.ui.toast('Hint: count the lit lamps in boxes A, B, C', 'gold'); return true; }
      return 'trail';
    };
    // the bot: reads the panels (it knows the code), lights the plates in turn, waits for the lasers like a person would
    w.botPlan = (g) => {
      const p = g.player;
      if (p.z < -58 && p.z > -100 && !gateOpen) {
        const next = plates.find((q) => w.t >= q.until - 0.1) || plates.find((q) => w.t > q.until);
        if (next) return { x: next.x, z: next.z };
        return { x: 0, z: -98 };
      }
      if (p.z < -33 && p.z > -58 && !opened) {
        if (Math.hypot(p.x - 5, p.z + 56.2) < 2.2) { openDoor(); return null; }
        return { x: 5, z: -56.2 };
      }
      return null;
    };
    w.vault = { code, digits, lasers, plates, get opened() { return opened; }, get gateOpen() { return gateOpen; }, openDoor };
    void onPlat; void crash;
  },
};
