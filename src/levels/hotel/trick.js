import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, GOLD } from './kit.js';
import { canvasPlane } from './escape-kit.js';
import { onPlat } from '../common.js';
import { trollCheckpoint, fakeExit, evasiveGoal, fakeComplete, twistZone, vanishAfter, crash, loadingScreen, adBreak, survey, stageTitle, stageHint } from './trolls.js';

// Floor 13 — "Management" (Why are u even trying). FIRST FULL PASS of five trick levels. Each one looks unwinnable and has an unexpected way out;
// the host swears there is none. Shared helpers live here; each level is built from them and the troll kit.
//   21 Floor 13            there is no button for it. Hold 1 and 3 together by the panel.
//   22 Terms & Conditions  a corridor of small print; the exit is in clause 47
//   23 Complaint Desk      a queue that never moves; you can just walk around it. Then three desks that send you to each other
//   24 Fire Drill          every exit loops back; the real one is the window you ignored
//   25 Management          the manager does not want you here; he obeys a DO NOT DISTURB sign

const RED = 0xff3a46;
const flatFloor = (w, zN, zS = 18, o = {}) => w.plat({ x: 0, y: 0, z: (zN + zS) / 2, w: 30, d: zS - zN, h: 1.2, tex: o.tex ?? 'marble', color: o.color ?? 0xffffff, roughness: 0.25, path: true });
function setup(w, game, { zN, H = 12, wallTex = 'damask', wallColor = 0xffffff, floorTex, floorColor, floor = true }) {
  hotelEnv(w);
  w.killY = -20;
  roomShell(w, { x0: -15, x1: 15, z0: zN - 3, z1: 18, yb: -30, H, wallTex, wallColor, pilasterEvery: 14, lamps: false });
  w.spawn = { x: 0, y: 0, z: 13, yaw: 0 }; w.respawn = { ...w.spawn };
  return floor ? flatFloor(w, zN, 18, { tex: floorTex, color: floorColor }) : null;
}
const blocker = (w, x, z, ww, dd, h = 4, color = 0x6b3a2a) => { const b = w.collider({ x, y: h / 2, z, w: ww, h, d: dd }); const m = new THREE.Mesh(new THREE.BoxGeometry(ww, h, dd), plainMaterial(color, { roughness: 0.5 })); m.position.set(x, h / 2, z); w.add(m); return { body: b, mesh: m, open() { b.enabled = false; m.visible = false; }, shut() { b.enabled = true; m.visible = true; } }; };
const host = (game, k, o = {}) => game.say(k, { priority: 1, ...o });
function hooks(w, game, P, names, intro) {
  let t0 = 0, said = false;
  w.hooks.frame = (dt, g) => { if (g.state !== 'playing') return; t0 += dt; if (!said && t0 > 1.2) { said = true; g.say(`${P}.intro`); stageTitle(g, w, 1, names.length, names[0]); } };
  w.hooks.onDeath = () => { if (Math.random() < 0.6) { game.say(`${P}.die`, { priority: 1 }); return true; } return false; };
  void intro;
}
const regCp = (w, game, names, P) => { const m = new Map(); const cp = (i, x, z) => m.set(w.checkpoint({ x, y: 0, z, real: true }), i); w.hooks.onCheckpoint = (c) => { const i = m.get(c); if (i !== undefined) stageTitle(game, w, i + 1, names.length, names[i]); }; void P; return cp; };

// =====================================================================================================================================
//  21 · Floor 13
// =====================================================================================================================================
export const floor13 = {
  id: 'hotel-21', name: 'Floor 13', music: 'hotel',
  completeQuip: 'You reached a floor that does not exist. The hotel is considering suing itself.',
  build(w, game) {
    const NAMES = ['The Panel', 'The Ride', 'Floor 13'];
    setup(w, game, { zN: -110, floor: false });
    w.plat({ x: 0, y: 0, z: -13, w: 30, d: 62, h: 1.2, tex: 'marble', color: 0xffffff, roughness: 0.25, path: true });   // the lobby and the lift
    const cp = regCp(w, game, NAMES, 'hotel.l21');
    // the lift lobby: a panel of buttons with a gap where 13 should be
    const PX = 11.4, PZ = -8;
    w.box({ x: PX + 0.2, y: 2.2, z: PZ, w: 0.3, h: 3.6, d: 3, color: 0x1c2028, metal: 0.5 });
    for (let k = 0; k < 14; k++) { const n = k + 1; const row = Math.floor(k / 2), col = k % 2; if (n === 13) continue;
      w.box({ x: PX - 0.05, y: 3.6 - row * 0.45, z: PZ - 0.7 + col * 1.4, w: 0.1, h: 0.3, d: 0.3, glow: n === 14 ? 0x6cf0b2 : 0xffd9a0, glowIntensity: 0.7, shadow: false }); }
    w.sign({ text: '11 12 · 14', x: PX - 0.12, y: 4.4, z: PZ, w: 2.4, h: 0.5, rotY: -Math.PI / 2, color: '#ffd9a0', double: false, tw: 256, size: 60 });
    const btn13 = w.box({ x: PX - 0.05, y: 2.5, z: PZ - 0.7, w: 0.1, h: 0.3, d: 0.3, glow: 0xff3a46, glowIntensity: 2, shadow: false, static: false }); btn13.visible = false;
    let presses = 0;
    w.interactable({ x: PX - 0.4, y: 2.8, z: PZ, w: 0.8, h: 2.4, d: 3, label: 'Press a button', onUse: () => { presses++; game.audio.click(); host(game, presses % 4 === 0 ? 'hotel.l21.press2' : 'hotel.l21.press', { priority: 1 }); } });
    const door = blocker(w, 0, -22, 6, 1.0, 5, 0x8a7a5a);
    w.sign({ text: 'LIFT', x: 0, y: 5.4, z: -21.4, w: 3, h: 0.9, color: '#ffd9a0', double: false, tw: 256, size: 90 });
    w.sign({ text: 'FLOOR 13 →', x: 0, y: 0.03, z: -17, w: 4.5, h: 1.1, rotX: -Math.PI / 2, color: '#ff8a8a', double: false, tw: 512, size: 70 });
    let opened = false;
    const open = () => { if (opened) return; opened = true; btn13.visible = true; door.open(); game.audio.chime(); game.ui.toast('13  ✔', 'good'); game.say('hotel.l21.found', { priority: 2 }); };
    w.onUpdate(() => { const p = game.player; if (!opened && Math.hypot(p.x - PX, p.z - PZ) < 3.5 && game.keys.has('Digit1') && game.keys.has('Digit3')) open(); });
    cp(1, -19);
    // the ride
    w.box({ x: 0, y: 2.5, z: -30, w: 0.3, h: 5, d: 0.3, color: 0x2a2f3c, shadow: false });
    let ridden = false;
    w.trigger({ x: 0, y: 1.5, z: -28, w: 10, h: 3, d: 1.5, once: true, resetOnRespawn: false, onEnter: () => { if (ridden) return; ridden = true; game.say('hotel.l21.ride', { priority: 2 }); loadingScreen(game, w, { sec: 2.5 }); w.after(0.1, () => {}); } });
    w.trigger({ x: 0, y: 1.5, z: -36, w: 10, h: 3, d: 1.5, once: true, onEnter: () => crash(game, w, { sec: 3, say: 'hotel.l21.floors', sayAfter: 'hotel.l21.arrive' }) });
    cp(2, -42);
    // floor 13: a corridor of vanishing tiles, a fake exit, a shy goal, a fake finish
    const tiles = [-48, -54, -60, -66].map((z, i) => { const p = w.plat({ x: i % 2 ? 2.5 : -2.5, y: 0, z, w: 4.4, d: 4.4, h: 0.5, tex: 'marble', color: 0xd8d0e0, roughness: 0.2, path: true }); vanishAfter(w, game, p, { axis: 'z', dir: -1, frac: 0.4, delay: 0.5, back: 3, say: i === 0 ? 'hotel.l21.tile' : null }); return p; });
    const land = w.plat({ x: 0, y: 0, z: -76, w: 12, d: 10, h: 0.6, tex: 'marble', color: 0xece3cf, roughness: 0.2, path: true });
    cp(2, -73);
    fakeExit(w, game, { x: -7, y: 0, z: -84, kind: 'door', label: 'EXIT', say: 'hotel.l21.closet', yaw: Math.PI / 2 });
    const runner = evasiveGoal(w, game, { spots: [{ x: 0, y: 0, z: -86 }, { x: 4, y: 0, z: -79 }], radius: 5, color: GOLD, say: 'hotel.l21.hop',
      onReach: () => { if (!fakeComplete(game, w, { title: 'FLOOR 13', sub: 'There is no floor 13', say: 'hotel.l21.fakewin', then: () => { w.goalObj = real; real.group.visible = true; real.trig.enabled = true; game.say('hotel.l21.again', { priority: 2 }); } })) game.completeLevel(); } });
    const real = w.goal({ x: 8, y: 0, z: -89, color: GOLD, onReach: () => { game.say('hotel.l21.done', { priority: 2 }); game.completeLevel(); } });
    real.group.visible = false; real.trig.enabled = false; w.goalObj = runner;
    // extend the floor under floor 13 (tiles hang over the void)
    w.plat({ x: 0, y: 0, z: -97, w: 30, d: 32, h: 1.2, tex: 'marble', color: 0xffffff, roughness: 0.25, path: true });   // floor 13's far side
    hooks(w, game, 'hotel.l21', NAMES);
    w.hintAction = (g) => { if (!opened && g.player.z > -22) { g.say('hotel.l21.hint', { priority: 1 }); g.ui.toast('Hint: stand at the panel and HOLD 1 and 3 together', 'gold'); return true; } return 'trail'; };
    stageHint(w, [{ at: { x: 0, y: 0, z: 13 }, route: [{ x: 11, y: 0, z: -8 }, { x: 0, y: 0, z: -21 }] }, { at: { x: 0, y: 0, z: -19 }, route: [{ x: 0, y: 0, z: -40 }] }, { at: { x: 0, y: 0, z: -42 }, route: tiles.map((p) => ({ x: p.body.x, y: 0, z: p.body.z })).concat([{ x: 0, y: 0, z: -76 }]) }], { end: { x: 0, y: 0, z: -88 } });
    w.botPlan = (g) => { const p = g.player; if (g.modal) g.closeModal(); if (!opened && p.z > -22) { if (Math.hypot(p.x - PX, p.z - PZ) < 3.0) { open(); return null; } return { x: PX - 2, z: PZ }; } return null; };
    void land; void onPlat; void twistZone; void adBreak; void survey; void trollCheckpoint; void glowMaterial; void canvasPlane;
  },
};

// =====================================================================================================================================
//  22 · Terms & Conditions
// =====================================================================================================================================
const CLAUSES = ['The Guest agrees to be a guest.', 'The Hotel agrees to nothing.', 'Gravity is not a defect.', 'All ceilings are optional.', 'The Host may lie, but only about directions.', 'Any resemblance to a lobby is coincidental.', 'The Guest waives the floor.', 'Fees may apply to fees.', 'The word "exit" is a trademark.', 'Smiling is mandatory after 9 p.m.', 'Elevators are a state of mind.', 'This clause intentionally left wrong.', 'Complaints are filed under "B".', 'The minibar is a sovereign nation.', 'Walking is a premium feature.'];
export const terms = {
  id: 'hotel-22', name: 'Terms & Conditions', music: 'hotel',
  completeQuip: 'You read the small print. Nobody has ever done that. The small print is shaken.',
  build(w, game) {
    const NAMES = ['Preamble', 'The Clauses', 'Clause 47'];
    setup(w, game, { zN: -112, wallTex: 'panel', wallColor: 0xe8e0d0 });
    const cp = regCp(w, game, NAMES, 'hotel.l22');
    // an inner west wall of small print, with a doorway nobody knows about
    const DZ = -66.8;
    for (let k = 0; k < 12; k++) {
      const zc = 8 - k * 8.5;
      const lines = []; for (let j = 0; j < 5; j++) { const n = k * 5 + j + 1; lines.push(n === 47 ? `47. The exit is behind this sentence. (Press E.)` : `${n}. ${CLAUSES[(n * 7) % CLAUSES.length]}`); }
      canvasPlane(w, { x: -13.05, y: 3.2, z: zc, width: 8.4, height: 5.2, rotY: Math.PI / 2, px: 1024, glow: 1.05,
        draw: (g, W, H) => { g.fillStyle = '#f4efe2'; g.fillRect(0, 0, W, H); g.fillStyle = '#2a2a2a'; g.font = '700 42px Arial'; g.fillText(`TERMS & CONDITIONS · PAGE ${k + 1} OF 12`, 30, 66); g.font = '30px Arial'; lines.forEach((t, i) => { g.fillStyle = t.startsWith('47.') ? '#b0302a' : '#444'; g.font = t.startsWith('47.') ? '700 26px Arial' : '30px Arial'; g.fillText(t, 30, 150 + i * 70); }); } });
    }
    // the wall behind the small print: solid except at clause 47
    const wallSeg = (z0, z1) => { if (z0 - z1 > 0.1) w.plat({ x: -13.4, y: 6, z: (z0 + z1) / 2, w: 0.6, d: z0 - z1, h: 6, tex: 'panel', color: 0xe8e0d0, roughness: 0.8 }); };
    wallSeg(16, DZ + 1.6); wallSeg(DZ - 1.6, -110);
    const secret = blocker(w, -13.4, DZ, 0.6, 3.2, 5, 0xf4efe2);
    let found = false;
    const find = () => { if (found) return; found = true; secret.open(); game.audio.chime(); game.ui.toast('§47 accepted', 'good'); game.say('hotel.l22.found', { priority: 2 }); };
    w.interactable({ x: -12.6, y: 3.0, z: DZ + 0.2, w: 1.0, h: 2.6, d: 3.4, label: 'Read clause 47', onUse: () => { if (!found) find(); } });
    const nicheGoal = w.goal({ x: -14.1, y: 0, z: DZ, color: GOLD, onReach: () => { game.say('hotel.l22.done', { priority: 2 }); game.completeLevel(); } });
    nicheGoal.group.visible = false; nicheGoal.trig.enabled = false;
    w.onUpdate(() => { if (found && !nicheGoal.group.visible) { nicheGoal.group.visible = true; nicheGoal.trig.enabled = true; w.goalObj = nicheGoal; } });
    // AGREE / DECLINE tiles: three pairs (the host says decline; declining is a hole)
    [-26, -44, -80].forEach((z, i) => {
      const agreeLeft = Math.random() < 0.5;
      for (const left of [true, false]) {
        const isAgree = left === agreeLeft, x = left ? -5.5 : 3.5;
        w.box({ x, y: 0.04, z, w: 5, h: 0.08, d: 4.5, color: isAgree ? 0x2e8a4a : 0xa02a2a, rough: 0.5, shadow: false });
        w.sign({ text: isAgree ? 'I AGREE' : 'I DECLINE', x, y: 0.1, z, w: 4.4, h: 1.2, rotX: -Math.PI / 2, color: '#fff', double: false, tw: 512, size: 80 });
        if (!isAgree) { const hz = w.hazard({ x, y: 0.3, z, w: 4.6, h: 0.6, d: 4.1, color: 0xff2d4d }); hz.core.visible = false; hz.shell.visible = false; }
      }
      void i;
    });
    w.sign({ text: 'PLEASE READ ALL 60 CLAUSES', x: 0, y: 5.6, z: 16.5, w: 10, h: 1.2, color: '#b0302a', double: false, tw: 1024, size: 70 });
    // cookies, an ad, a crash, a fake exit at the end
    w.trigger({ x: 0, y: 1.5, z: -14, w: 20, h: 4, d: 1.5, once: true, onEnter: () => survey(game, w, { title: 'COOKIES', lines: ['This corridor uses cookies.', 'Rate your consent: 1 – 5'], thanks: 'Consent recorded. Under "B".', say: 'hotel.l22.cookies' }) });
    w.trigger({ x: 0, y: 1.5, z: -52, w: 20, h: 4, d: 1.5, once: true, onEnter: () => adBreak(game, w, { sec: 4, say: 'hotel.l22.ad', sayAfter: null }) });
    w.trigger({ x: 0, y: 1.5, z: -90, w: 20, h: 4, d: 1.5, once: true, onEnter: () => crash(game, w, { sec: 3, say: 'hotel.l22.crash', sayAfter: 'hotel.l22.crash.after' }) });
    fakeExit(w, game, { x: 7, y: 0, z: -106, kind: 'door', label: 'EXIT · I AGREE', say: 'hotel.l22.fake', yaw: -Math.PI / 2 });
    cp(1, -30); cp(2, -62);
    hooks(w, game, 'hotel.l22', NAMES);
    w.hintAction = (g) => { if (!found && g.player.z < 20) { g.say('hotel.l22.hint', { priority: 1 }); g.ui.toast('Hint: clause 47 is on the west wall, and it can be read', 'gold'); return true; } return 'trail'; };
    stageHint(w, [{ at: { x: 0, y: 0, z: 13 }, route: [{ x: 0, y: 0, z: -28 }] }, { at: { x: 0, y: 0, z: -30 }, route: [{ x: 0, y: 0, z: -60 }] }, { at: { x: 0, y: 0, z: -62 }, route: [{ x: -11, y: 0, z: DZ }] }], { end: { x: -14, y: 0, z: DZ } });
    w.botPlan = (g) => { const p = g.player; if (g.modal) g.closeModal(); if (p.z < -58 && !found) { if (Math.hypot(p.x + 12.6, p.z - DZ) < 3) { find(); return null; } return { x: -11, z: DZ }; } if (found) return { x: -14, z: DZ }; return { x: p.x < -0.5 && p.z > -100 ? 0 : 0, z: p.z - 10 }; };
    w.terms = { get found() { return found; } };
  },
};

// =====================================================================================================================================
//  23 · Complaint Desk
// =====================================================================================================================================
export const complaint = {
  id: 'hotel-23', name: 'Complaint Desk', music: 'hotel',
  completeQuip: 'Your complaint has been filed. It was not read. It was framed.',
  build(w, game) {
    const NAMES = ['The Queue', 'Three Desks', 'Filed'];
    setup(w, game, { zN: -100, wallTex: 'tile', wallColor: 0xe9eef2, floorTex: 'tile', floorColor: 0xd8dde2 });
    const cp = regCp(w, game, NAMES, 'hotel.l23');
    // the queue: a lane of stanchions and 14 patient statues, a rope that anyone can step over
    const stat = plainMaterial(0xcfc7b8, { roughness: 0.8 });
    for (let i = 0; i < 14; i++) { const z = -4 - i * 2.8; const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.0, 4, 8), stat); s.position.set(0, 1.0, z); w.add(s); const h = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), stat); h.position.set(0, 1.9, z); w.add(h); }
    for (const sx of [-1, 1]) for (let z = 0; z > -44; z -= 3) { w.box({ x: sx * 1.5, y: 0.5, z, w: 0.1, h: 1.0, d: 0.1, color: GOLD, metal: 1, shadow: false }); w.box({ x: sx * 1.5, y: 0.95, z: z - 1.5, w: 0.04, h: 0.04, d: 3, color: 0x7a1030, shadow: false }); }
    w.sign({ text: 'NOW SERVING 3 · YOU ARE 4,012', x: 0, y: 5.4, z: -46, w: 12, h: 1.2, color: '#ff8a8a', double: false, tw: 1024, size: 80, glow: true });
    w.sign({ text: 'NO CUTTING. CUTTING IS A CRIME.', x: 5, y: 3.4, z: -12, w: 7, h: 0.9, color: '#ffd9a0', double: false, tw: 1024, size: 60 });
    // carts cross the hall (hop them)
    [[-16, 3.4, 1.0], [-30, 3.6, 1.2]].forEach(([z, a, sp], i) => { const hz = w.hazard({ x: 0, y: 0.45, z, w: 2.6, h: 0.9, d: 1.4, color: RED, move: (t) => ({ x: a * Math.sin(t * sp + i * 2) }) }); hz.core.visible = false; hz.shell.visible = false; hz.jumpable = true; hz.group.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.2), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 }))); });
    w.trigger({ x: 7, y: 1.5, z: -24, w: 10, h: 3, d: 8, once: true, onEnter: () => game.say('hotel.l23.cut', { priority: 2 }) });   // walking round the queue: the host is scandalised, and nothing happens
    cp(1, -50);
    // three desks, in the order the host does NOT say: B, then C, then A
    const order = ['B', 'C', 'A']; let step = 0, done = false;
    const gate = blocker(w, 0, -84, 30, 1.0, 5, 0x8a7a5a);
    const deskAt = { A: -9, B: 0, C: 9 };
    for (const [L, x] of Object.entries(deskAt)) {
      w.plat({ x, y: 1.1, z: -62, w: 6, d: 1.6, h: 1.1, tex: 'wood', color: 0xffffff, roughness: 0.3 });
      w.sign({ text: 'DESK ' + L, x, y: 3.2, z: -62.9, w: 4, h: 1.0, color: '#f1d28a', double: false, tw: 512, size: 100 });
      w.interactable({ x, y: 1.6, z: -60.8, w: 5, h: 1.4, d: 0.9, label: `Desk ${L}`, onUse: () => {
        if (done) return;
        if (L === order[step]) { step++; game.audio.chime(); game.ui.toast(`✔ stamp ${step} of 3`, 'good'); game.say(step === 3 ? 'hotel.l23.third' : 'hotel.l23.right', { priority: 1 }); if (step === 3) { done = true; gate.open(); } }
        else { step = 0; game.audio.buzzer?.(); game.ui.toast('✖ Wrong desk. Start again.', 'bad'); game.say('hotel.l23.wrong', { priority: 1, vars: { desk: order[0] } }); }
      } });
    }
    w.sign({ text: 'FORM 38: DESK A, THEN B, THEN C', x: 0, y: 5.6, z: -58.5, w: 12, h: 1.0, color: '#ffd9a0', double: false, tw: 1024, size: 60 });   // (the host's order: wrong)
    cp(2, -66);
    trollCheckpoint(w, game, { x: 0, y: 0, z: -75, mode: 'fake' });
    w.trigger({ x: 0, y: 1.5, z: -72, w: 20, h: 3, d: 1.5, once: true, onEnter: () => survey(game, w, { title: 'HOW IS YOUR COMPLAINT?', lines: ['We value your complaint.', 'Rate it: 1 – 5'], thanks: 'Your rating has been complained about.', say: 'hotel.l23.survey' }) });
    const runner = evasiveGoal(w, game, { spots: [{ x: 0, y: 0, z: -92 }, { x: -6, y: 0, z: -88 }, { x: 5, y: 0, z: -94 }], radius: 5, color: GOLD, say: 'hotel.l23.hop',
      onReach: () => { if (!fakeComplete(game, w, { title: 'COMPLAINT FILED', say: 'hotel.l23.fakewin', then: () => { w.goalObj = real; real.group.visible = true; real.trig.enabled = true; game.say('hotel.l23.again', { priority: 2 }); } })) game.completeLevel(); } });
    const real = w.goal({ x: 9, y: 0, z: -97, color: GOLD, onReach: () => { game.say('hotel.l23.done', { priority: 2 }); game.completeLevel(); } });
    real.group.visible = false; real.trig.enabled = false; w.goalObj = runner;
    hooks(w, game, 'hotel.l23', NAMES);
    w.hintAction = (g) => { if (!done && g.player.z < -52) { g.say('hotel.l23.hint', { priority: 1 }); g.ui.toast('Hint: the stamps go B, then C, then A', 'gold'); return true; } return 'trail'; };
    stageHint(w, [{ at: { x: 0, y: 0, z: 13 }, route: [{ x: 5, y: 0, z: -24 }, { x: 0, y: 0, z: -48 }] }, { at: { x: 0, y: 0, z: -50 }, route: [{ x: 0, y: 0, z: -58 }] }, { at: { x: 0, y: 0, z: -66 }, route: [{ x: 0, y: 0, z: -82 }] }], { end: { x: 0, y: 0, z: -92 } });
    w.botPlan = (g) => { const p = g.player; if (g.modal) g.closeModal(); if (p.z < -52 && !done) { const L = order[step]; const dx = deskAt[L]; if (Math.hypot(p.x - dx, p.z + 60.8) < 2.4) { step++; if (step >= 3) { done = true; gate.open(); } return null; } return { x: dx, z: -59.6 }; } if (p.z > -24 && p.z < 0) return { x: 5, z: -30 }; return null; };
    w.complaint = { order, get done() { return done; } };
  },
};

// =====================================================================================================================================
//  24 · Fire Drill
// =====================================================================================================================================
export const fireDrill = {
  id: 'hotel-24', name: 'Fire Drill', music: 'hotel',
  completeQuip: 'You used the window. Nobody uses the window. The fire marshal is writing it down.',
  build(w, game) {
    const NAMES = ['Evacuate', 'The Long Way', 'The Window'];
    setup(w, game, { zN: -50, wallTex: 'panel', wallColor: 0xe8d8c8 });
    const cp = regCp(w, game, NAMES, 'hotel.l24');
    // the drill: the lights pulse red, the signs say EXIT. Four doors in the north wall; three are loops
    const wall = (x0, x1) => w.plat({ x: (x0 + x1) / 2, y: 6, z: -9, w: x1 - x0, d: 1.2, h: 6, tex: 'panel', color: 0xe8d8c8, roughness: 0.8 });
    const DX = [-10, -3.5, 3.5, 10];
    wall(-15, DX[0] - 1.3); for (let i = 0; i < 3; i++) wall(DX[i] + 1.3, DX[i + 1] - 1.3); wall(DX[3] + 1.3, 15);
    for (const x of DX) w.plat({ x, y: 6, z: -9, w: 2.6, d: 1.2, h: 3.4, tex: 'panel', color: 0xe8d8c8, roughness: 0.8 });   // lintels (y 2.6..6)
    const doors = DX.map((x, i) => { const d = blocker(w, x, -9, 2.6, 1.0, 2.6, i === 2 ? 0x2a6a4a : 0x3a6a8a); w.sign({ text: 'EXIT', x, y: 3.3, z: -8.3, w: 1.8, h: 0.6, color: '#6cf0b2', double: false, tw: 256, size: 80, glow: true }); return d; });
    const lamp = new THREE.PointLight(0xff3a46, 0, 30); lamp.position.set(0, 7, 4); w.add(lamp);
    w.onUpdate((dt, t) => { lamp.intensity = game.baby ? 0 : 6 + Math.sin(t * 4) * 5; });
    const loop = (i) => { game.audio.glitch(); game.ui.glitch(true); setTimeout(() => game.ui.glitch(false), 200); game.player.teleport(0, 0.001, 13); game.say(`hotel.l24.loop${i % 3}`, { priority: 2 }); };
    [0, 1, 3].forEach((i) => w.interactable({ x: DX[i], y: 1.4, z: -7.8, w: 2.4, h: 2.6, d: 1.4, label: 'Open EXIT', onUse: () => loop(i) }));
    w.interactable({ x: DX[2], y: 1.4, z: -7.8, w: 2.4, h: 2.6, d: 1.4, label: 'Open EXIT', enabled: () => doors[2].body.enabled, onUse: () => { doors[2].open(); game.audio.click(); game.say('hotel.l24.open', { priority: 2 }); } });
    // the window you ignored: east wall, a DO NOT OPEN sign, a ledge outside
    w.box({ x: 14.7, y: 2.6, z: 3, w: 0.3, h: 2.2, d: 3, color: 0x2a3a4a, rough: 0.2 });
    w.box({ x: 14.5, y: 2.6, z: 3, w: 0.1, h: 1.9, d: 2.6, glow: 0x6a8aff, glowIntensity: 0.5, shadow: false });
    w.sign({ text: 'DO NOT OPEN', x: 14.4, y: 4.0, z: 3, w: 2.4, h: 0.5, rotY: -Math.PI / 2, color: '#ff8a8a', double: false, tw: 256, size: 60 });
    // a corridor behind door 3: lasers, then an EXIT that is a loop too
    const RAIL = []; void RAIL;
    const blink = (z, P, on, ph) => { const hz = w.hazard({ x: 0, y: 1.3, z, w: 29, h: 2.6, d: 0.25, color: RED }); const isOn = (t) => ((t + ph) % P) < on; hz.predict = isOn; w.onUpdate((dt, t) => { const o = isOn(t); hz.enabled = o; hz.group.visible = o; }); };
    blink(-20, 4.6, 1.5, 0); blink(-28, 4.8, 1.5, 1.7); blink(-36, 4.4, 1.5, 2.9);
    w.interactable({ x: 0, y: 1.4, z: -45, w: 3, h: 2.6, d: 1.4, label: 'Open EXIT', onUse: () => { loop(2); game.say('hotel.l24.longloop', { priority: 2 }); } });
    w.box({ x: 0, y: 1.3, z: -47, w: 2.6, h: 2.6, d: 0.2, color: 0x2a6a4a }); w.sign({ text: 'EXIT', x: 0, y: 3.3, z: -46.8, w: 2, h: 0.6, color: '#6cf0b2', double: false, tw: 256, size: 80, glow: true });
    cp(1, -14);
    // outside: the ledge (a fire escape of five platforms), fake assembly point, a shy goal
    const OX = 32;
    const ledge = [[OX, 0, 3, 6, 6], [OX + 6, 0, -1, 3, 3], [OX + 11, 0, -4, 3, 3], [OX + 16, 0, -1, 3, 3], [OX + 21, 0, -5, 3, 3]].map(([x, y, z, ww, dd], i) => { const p = w.plat({ x, y, z, w: ww, d: dd, h: 0.5, tex: 'metal', color: 0x8a8d95, roughness: 0.5, path: true }); if (i === 2) w.crumble(p, { delay: 0.5, gone: 3.2 }); if (i === 3) vanishAfter(w, game, p, { axis: 'x', dir: 1, frac: 0.4, delay: 0.5, back: 3 }); return p; });
    const stand = w.plat({ x: OX + 28, y: 0, z: -5, w: 10, d: 10, h: 0.6, tex: 'marble', color: 0xece3cf, path: true });
    w.sign({ text: 'ASSEMBLY POINT', x: OX + 28, y: 5, z: -9.9, w: 7, h: 1.2, color: '#6cf0b2', double: false, tw: 1024, size: 80, glow: true });
    w.box({ x: OX + 3, y: 0.5, z: 0, w: 0.2, h: 0.2, d: 0.2, color: 0xffd9a0, glow: 0xffd9a0, shadow: false });
    let out = false;
    const climb = () => { if (out) return; out = true; game.player.teleport(OX, 0.001, 3); game.audio.chime(); game.say('hotel.l24.window', { priority: 2 }); };
    w.interactable({ x: 14.0, y: 2.6, z: 3, w: 1.2, h: 2.4, d: 3.2, label: 'Open the window', onUse: climb });
    cp(2, 5);
    w.onRespawn(() => { out = out && game.player.x > 20; });
    const runner = evasiveGoal(w, game, { spots: [{ x: OX + 28, y: 0, z: -8 }, { x: OX + 25, y: 0, z: -2 }], radius: 4.5, color: GOLD, say: 'hotel.l24.hop',
      onReach: () => { if (!fakeComplete(game, w, { title: 'ALL CLEAR', say: 'hotel.l24.fakewin', then: () => { w.goalObj = real; real.group.visible = true; real.trig.enabled = true; game.say('hotel.l24.again', { priority: 2 }); } })) game.completeLevel(); } });
    const real = w.goal({ x: OX + 31, y: 0, z: -2, color: GOLD, onReach: () => { game.say('hotel.l24.done', { priority: 2 }); game.completeLevel(); } });
    real.group.visible = false; real.trig.enabled = false; w.goalObj = runner;
    hooks(w, game, 'hotel.l24', NAMES);
    w.hintAction = (g) => { if (g.player.x < 20) { g.say('hotel.l24.hint', { priority: 1 }); g.ui.toast('Hint: the window on the east wall opens', 'gold'); return true; } return 'trail'; };
    stageHint(w, [{ at: { x: 0, y: 0, z: 13 }, route: [{ x: 13, y: 0, z: 3 }] }, { at: { x: 0, y: 0, z: -14 }, route: [{ x: 13, y: 0, z: 3 }] }, { at: { x: OX, y: 0, z: 5 }, route: ledge.map((p) => ({ x: p.body.x, y: 0, z: p.body.z })).concat([{ x: OX + 28, y: 0, z: -5 }]) }], { end: { x: OX + 28, y: 0, z: -3 } });
    w.botPlan = (g) => { const p = g.player; if (p.x < 20) { if (Math.hypot(p.x - 13.2, p.z - 3) < 2.4) { climb(); return null; } return { x: 13.2, z: 3 }; } return null; };
    void stand; void onPlat;
  },
};

// =====================================================================================================================================
//  25 · Management
// =====================================================================================================================================
export const management = {
  id: 'hotel-25', name: 'Management', music: 'hotel',
  completeQuip: 'You met the manager. He does not like to be disturbed. Neither did you. And yet.',
  build(w, game) {
    const NAMES = ['The Corridor', 'The Office', 'Employee of the Month'];
    setup(w, game, { zN: -86, wallTex: 'damask', wallColor: 0xd8c8a8, floorTex: 'carpet', floorColor: 0x5a2a2a });
    const cp = regCp(w, game, NAMES, 'hotel.l25');
    // the corridor: doors that say MANAGEMENT, lasers, a ticket that lies
    const blink = (z, P, on, ph) => { const hz = w.hazard({ x: 0, y: 1.3, z, w: 29, h: 2.6, d: 0.25, color: RED }); const isOn = (t) => ((t + ph) % P) < on; hz.predict = isOn; w.onUpdate((dt, t) => { const o = isOn(t); hz.enabled = o; hz.group.visible = o; }); };
    blink(0, 4.6, 1.5, 0); blink(-9, 4.8, 1.5, 1.7); blink(-18, 4.4, 1.5, 3.1);
    w.sign({ text: 'MANAGEMENT ONLY', x: 0, y: 5.6, z: 16.6, w: 10, h: 1.4, color: '#f1d28a', double: false, tw: 1024, size: 100 });
    cp(1, -26);
    // the office: a desk the size of a car, a manager, three DO NOT DISTURB signs
    const desk = blocker(w, 0, -62, 8, 2.6, 1.4, 0x4a2a1a);
    w.sign({ text: 'THE MANAGER', x: 0, y: 5.6, z: -83, w: 8, h: 1.4, color: '#f1d28a', double: false, tw: 1024, size: 100 });
    const mgr = new THREE.Group(); w.add(mgr);
    const dark = plainMaterial(0x1c1c24, { roughness: 0.5 }), skin = plainMaterial(0xe6c0a0, { roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.5, 14), dark); body.position.y = 1.0; mgr.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), skin); head.position.y = 2.1; mgr.add(head);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.05), plainMaterial(0xb0302a)); tie.position.set(0, 1.2, -0.52); mgr.add(tie);
    const M = { x: 0, z: -66, frozen: 0, running: false, start: -1 };
    const SPEED = 5.2;
    mgr.position.set(M.x, 0, M.z);
    // signs: pressing one makes him stop (he obeys them; it is the only rule he keeps)
    const signs = [[-12, -46], [12, -56], [-12, -74]].map(([x, z], i) => {
      const board = w.box({ x, y: 2.2, z, w: 0.1, h: 0.9, d: 1.6, color: 0xb0302a, shadow: false, rotY: 0 });
      w.sign({ text: 'DO NOT\nDISTURB', x: x * 0.985, y: 2.2, z, w: 1.5, h: 0.8, rotY: x < 0 ? Math.PI / 2 : -Math.PI / 2, color: '#fff', double: false, tw: 256, size: 60 });
      void board; void i;
      return { x, z, cool: 0 };
    });
    const hang = (s) => { if (s.cool > 0 || !M.running) return; s.cool = 8; M.frozen = 5.5; game.audio.chime(); game.ui.toast('🚫 He stops. It is the only rule he keeps.', 'good'); game.say('hotel.l25.sign', { priority: 2 }); };
    signs.forEach((s) => w.interactable({ x: s.x * 0.97, y: 2.2, z: s.z, w: 1.4, h: 1.4, d: 2.2, label: 'Hang DO NOT DISTURB', onUse: () => hang(s) }));
    w.trigger({ x: 0, y: 1.5, z: -40, w: 30, h: 3, d: 1.5, once: true, resetOnRespawn: true, onEnter: () => { M.running = true; M.start = w.t + 2.5; game.say('hotel.l25.wakes', { priority: 2 }); } });
    w.onRespawn(() => { M.x = 0; M.z = -66; M.running = false; M.frozen = 0; for (const s of signs) s.cool = 0; mgr.position.set(0, 0, -66); });
    w.onUpdate((dt, t) => {
      for (const s of signs) s.cool = Math.max(0, s.cool - dt);
      if (!M.running || game.state !== 'playing' || t < M.start) return;
      M.frozen = Math.max(0, M.frozen - dt);
      if (M.frozen > 0) { mgr.rotation.z = 0.15; return; }
      mgr.rotation.z = 0;
      const p = game.player, dx = p.x - M.x, dz = p.z - M.z, d = Math.hypot(dx, dz) || 1, sp = SPEED * (game.baby ? 0.7 : 1) * dt;
      M.x += (dx / d) * Math.min(sp, d); M.z += (dz / d) * Math.min(sp, d);
      mgr.position.set(M.x, 0, M.z); mgr.rotation.y = Math.atan2(-dx, -dz);
      if (d < 1.0 && Math.abs(p.y) < 2) { game.say('hotel.l25.caught', { priority: 2 }); game.kill('manager'); }
    });
    cp(2, -44);
    // behind the desk: the real goal (the "revolving door"), and a fake window exit
    fakeExit(w, game, { x: 8, y: 0, z: -82, kind: 'door', label: "MANAGER'S EXIT", say: 'hotel.l25.closet', yaw: Math.PI });
    const runner = evasiveGoal(w, game, { spots: [{ x: 0, y: 0, z: -75 }, { x: -6, y: 0, z: -79 }], radius: 4.5, color: GOLD, say: 'hotel.l25.hop',
      onReach: () => { if (!fakeComplete(game, w, { title: 'EMPLOYEE OF THE MONTH', say: 'hotel.l25.fakewin', then: () => { w.goalObj = real; real.group.visible = true; real.trig.enabled = true; game.say('hotel.l25.again', { priority: 2 }); } })) game.completeLevel(); } });
    const real = w.goal({ x: -10, y: 0, z: -83, color: GOLD, onReach: () => { game.say('hotel.l25.done', { priority: 2 }); game.completeLevel(); } });
    real.group.visible = false; real.trig.enabled = false; w.goalObj = runner;
    hooks(w, game, 'hotel.l25', NAMES);
    w.hintAction = (g) => { if (g.player.z < -38) { g.say('hotel.l25.hint', { priority: 1 }); g.ui.toast('Hint: he stops when you hang a DO NOT DISTURB sign (E)', 'gold'); return true; } return 'trail'; };
    stageHint(w, [{ at: { x: 0, y: 0, z: 13 }, route: [{ x: 0, y: 0, z: -24 }] }, { at: { x: 0, y: 0, z: -26 }, route: [{ x: 0, y: 0, z: -42 }] }, { at: { x: 0, y: 0, z: -44 }, route: [{ x: 12, y: 0, z: -56 }, { x: -12, y: 0, z: -74 }] }], { end: { x: -3, y: 0, z: -78 } });
    // the bot: hang the nearest sign whenever he is close, then run for the goal
    w.botPlan = (g) => {
      const p = g.player;
      if (M.running && p.z < -44) {
        const close = Math.hypot(p.x - M.x, p.z - M.z) < 9;
        const s = signs.filter((q) => q.cool <= 0).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
        if (close && s && M.frozen <= 0 && Math.hypot(s.x - p.x, s.z - p.z) < 3) { hang(s); return null; }
        if (M.frozen <= 0 && s && Math.hypot(s.x - p.x, s.z - p.z) < 14 && close) return { x: s.x * 0.8, z: s.z };
      }
      return null;
    };
    w.mgmt = { M, signs, desk };
    void onPlat; void twistZone; void trollCheckpoint; void vanishAfter; void glowMaterial; void canvasPlane; void survey; void adBreak; void crash; void loadingScreen;
  },
};
