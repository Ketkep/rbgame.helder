import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, GOLD } from './kit.js';
import { openBill } from '../../engine/bill.js';
import { trollCheckpoint, fakeExit, fakeComplete, loadingScreen, vanishAfter, twistZone, stageTitle, stageHint } from './trolls.js';

// Hotel level 20 — "Checkout" (Impossible · Penthouse). FIRST FULL PASS of the boss: pay the bill. Everything the hotel did to you, once more.
//   1 The Queue       luggage carts crossing the hall, a ticket machine ("NOW SERVING 0 · YOU ARE 99999")
//   2 The Desk        the bill (a tip is required). The card is declined: cash only. The desk closes. A gate opens
//   3 Cash Only       two belts against you, laser walls, an ATM that "loads" for three seconds
//   4 The Long Way    the way back has no floor: crumbling chandeliers, a fake checkpoint, an expiring one, a bar that leaves
//   5 Pay Again       the second bill is bigger; "CHECKED OUT" is a lie; the manager's door is a closet; the real door is the revolving one

const NAMES = ['The Queue', 'The Desk', 'Cash Only', 'The Long Way', 'Pay Again'];

export default {
  id: 'hotel-20',
  name: 'Checkout',
  music: 'hotel',
  completeQuip: 'You checked out. Please rate your stay. We have already rated it for you. It is a 9.4. Out of 100.',

  build(w, game) {
    hotelEnv(w);
    w.killY = -22;
    roomShell(w, { x0: -15, x1: 15, z0: -205, z1: 18, yb: -40, H: 14, wallTex: 'damask', pilasterEvery: 14, lamps: false });
    const marble = (o) => w.plat({ tex: 'marble', color: 0xffffff, roughness: 0.2, ...o });
    const floor = (z0, z1) => marble({ x: 0, y: 0, z: (z0 + z1) / 2, w: 30, d: z0 - z1, h: 1.2 });
    w.spawn = { x: 0, y: 0, z: 13, yaw: 0 }; w.respawn = { ...w.spawn };
    const stages = [{ at: { x: 0, y: 0, z: 13 } }, { at: { x: 0, y: 0, z: -49 } }, { at: { x: 0, y: 0, z: -64 } }, { at: { x: 0, y: 0, z: -108 } }, { at: { x: 0, y: 0, z: -153 } }].map((s) => ({ ...s, route: [] }));
    const cps = new Map();
    const cp = (i, z) => { cps.set(w.checkpoint({ x: 0, y: 0, z, real: true }), i); };
    const mark = (p) => { p.o.path = true; return p; };
    const RED = 0xff3a46;
    let paid1 = false, cash = false, paid2 = false;
    const bonusGoal = { on: false };

    // ===== 1 · the queue
    mark(floor(18, -58));
    for (const sx of [-1, 1]) for (let z = 4; z > -48; z -= 4) { w.box({ x: sx * 5.5, y: 0.5, z, w: 0.12, h: 1.0, d: 0.12, color: GOLD, metal: 1, shadow: false }); if (z < 4) w.box({ x: sx * 5.5, y: 0.9, z: z + 2, w: 0.05, h: 0.05, d: 4, color: 0x7a1030, shadow: false }); }
    const carts = [[0, -14, 3.6, 0.9], [0, -26, 3.8, 1.1], [0, -38, 3.6, 1.3]].map(([x, z, a, sp], i) => {
      const hz = w.hazard({ x: 0, y: 0.45, z, w: 2.6, h: 0.9, d: 1.4, color: RED, move: (t) => ({ x: a * Math.sin(t * sp + i * 1.7) }) });
      hz.core.visible = false; hz.shell.visible = false; hz.jumpable = true;
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.2), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); hz.group.add(b);
      return hz;
    });
    w.sign({ text: 'NOW SERVING 0', x: 0, y: 5.5, z: -45, w: 9, h: 1.4, color: '#ff8a8a', double: false, tw: 1024, size: 100, glow: true });
    w.box({ x: 8, y: 0.9, z: 6, w: 1.2, h: 1.8, d: 0.8, color: 0x1c2028, metal: 0.4 });
    w.interactable({ x: 8, y: 1.2, z: 6.5, w: 1.4, h: 1.6, d: 1.2, label: 'Take a number', onUse: () => { game.audio.chime(); game.ui.toast('🎫 YOU ARE NUMBER 99999', 'bad'); game.say('hotel.l20.ticket', { priority: 1 }); } });
    cp(1, -49);

    // ===== 2 · the desk
    for (const sx of [-1, 1]) w.plat({ x: sx * 9, y: 1.1, z: -54, w: 10, d: 1.6, h: 1.1, tex: 'wood', color: 0xffffff, roughness: 0.3 });
    w.plat({ x: 0, y: 3.2, z: -54, w: 8, d: 1.6, h: 0.5, tex: 'wood', color: 0xffffff, roughness: 0.3 });   // (an arch over the gate)
    const gate = w.collider({ x: 0, y: 1.1, z: -54, w: 8, h: 2.2, d: 1.4 });
    const gateVis = new THREE.Mesh(new THREE.BoxGeometry(8, 2.2, 1.4), plainMaterial(0x6b3a2a, { roughness: 0.5 })); gateVis.position.set(0, 1.1, -54); w.add(gateVis);
    w.sign({ text: 'CHECK-OUT DESK', x: 0, y: 5.4, z: -53.2, w: 8, h: 1.2, color: '#f1d28a', double: false, tw: 1024, size: 100 });
    const finish1 = () => { if (paid1) return; paid1 = true; gate.enabled = false; gateVis.visible = false; game.ui.toast('✖ Card declined: CASH ONLY', 'bad'); game.say('hotel.l20.declined', { priority: 2 }); };
    w.interactable({ x: 0, y: 1.3, z: -52.4, w: 8, h: 1.4, d: 0.8, label: () => (paid1 ? 'Desk closed' : 'Pay the bill'), enabled: () => !paid1, onUse: (g) => {
      game.say('hotel.l20.bill1', { priority: 2 });
      openBill(g, { title: 'CHECKOUT · YOUR BILL', lines: [['Room (1 night)', 189], ['Resort fee', 45], ['Convenience fee', 12.5], ['Fee for the fees', 6.66], ['Wet floor surcharge', 25], ['Minibar (unopened)', 0]], tips: [18, 20, 25],
        strings: { noTip: 'Please select a tip. Tipping is how we say thank you.', paid: 'Processing…' }, onPay: finish1 });
    } });
    cp(2, -63);

    // ===== 3 · cash only: belts against you, laser walls, the ATM
    mark(floor(-60, -66));
    const belts = [-6.5, 6.5].map((x) => { const p = marble({ x, y: 0, z: -84, w: 9, d: 36, h: 1.2 }); w.conveyor(p, { vz: 3.4 }); return p; });
    const mid = mark(marble({ x: 0, y: 0, z: -84, w: 4, d: 36, h: 1.2 })); void mid; void belts;
    const blinker = (z, P, on, ph) => {
      const hz = w.hazard({ x: 0, y: 1.3, z, w: 29.4, h: 2.6, d: 0.25, color: RED });
      const line = w.box({ x: 0, y: 0.9, z, w: 29.4, h: 0.04, d: 0.04, glow: RED, glowIntensity: 0.6, shadow: false, static: false });
      const isOn = (t) => ((t + ph) % P) < on; hz.predict = isOn;
      w.onUpdate((dt, t) => { const o = isOn(t); hz.enabled = o; hz.group.visible = o; line.visible = !o; });
      return hz;
    };
    blinker(-72, 4.4, 1.5, 0); blinker(-82, 4.8, 1.6, 1.4); blinker(-92, 4.6, 1.5, 2.6);
    mark(marble({ x: 0, y: 0, z: -106, w: 30, d: 8, h: 1.2 }));
    w.box({ x: 0, y: 1.2, z: -108.8, w: 1.4, h: 2.4, d: 0.8, color: 0x1c2028, metal: 0.4 });
    w.box({ x: 0, y: 1.8, z: -108.35, w: 1.0, h: 0.7, d: 0.04, glow: 0x6cf0b2, glowIntensity: 1.2, shadow: false });
    w.sign({ text: 'ATM', x: 0, y: 3.2, z: -108.3, w: 2, h: 0.7, color: '#6cf0b2', double: false, tw: 256, size: 90, glow: true });
    const takeCash = () => { cash = true; game.ui.toast('💵 CASH: $400.00 (fee $39.99)', 'gold'); game.say('hotel.l20.cash', { priority: 2 }); };
    w.interactable({ x: 0, y: 1.4, z: -107.6, w: 1.6, h: 1.6, d: 1.0, label: () => (cash ? 'ATM (empty)' : 'Use the ATM'), enabled: () => !cash, onUse: () => loadingScreen(game, w, { sec: 3, say: 'hotel.l20.atm', sayAfter: null }) || w.after(3.2, () => { if (!cash) takeCash(); }) });
    cp(3, -104);

    // ===== 4 · the long way: no floor
    const lamp = (x, y, z, s = 2.2) => w.plat({ x, y, z, w: s, d: s, h: 0.3, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.1 });
    trollCheckpoint(w, game, { x: 0, y: 0, z: -112, mode: 'fake' });
    mark(marble({ x: 0, y: 0, z: -112, w: 8, d: 4, h: 0.6 }));
    [[-1.4, -116.6], [1.4, -120.8], [-1.4, -125.0], [1.4, -129.2], [0, -133.4]].forEach(([x, z]) => mark(w.crumble(lamp(x, 0, z), { delay: 0.45, gone: 3.2 })));
    const bar = mark(marble({ x: 0, y: 0, z: -142.5, w: 2.2, d: 8.5, h: 0.3 }));
    vanishAfter(w, game, bar, { axis: 'z', dir: -1, frac: 0.5, delay: 0.7, back: 3.2, say: 'hotel.l20.bar' });
    twistZone(game, w, { x: 0, y: 2, z: -125, w: 5, h: 4, d: 3 }, 'swap', { sec: 5, say: 'hotel.l20.swap' });
    mark(floor(-147, -203)); cp(4, -153);
    trollCheckpoint(w, game, { x: 0, y: 0, z: -153, mode: 'expire', ttl: 30, say: 'hotel.l20.expired' });

    // ===== 5 · pay again
    w.plat({ x: 0, y: 1.1, z: -164, w: 8, d: 1.6, h: 1.1, tex: 'wood', color: 0xffffff, roughness: 0.3 });
    w.sign({ text: 'CHECK-OUT · CASH', x: 0, y: 3.4, z: -163.2, w: 8, h: 1.1, color: '#f1d28a', double: false, tw: 1024, size: 90 });
    const real = w.goal({ x: 0, y: 0, z: -198, color: GOLD, onReach: () => { game.say('hotel.l20.done', { priority: 2 }); game.completeLevel(); } });
    real.group.visible = false; real.trig.enabled = false;
    const finish2 = () => {
      if (paid2) return; paid2 = true;
      if (!fakeComplete(game, w, { title: 'CHECKED OUT', sub: 'Thank you for staying', say: 'hotel.l20.fakewin', then: () => { bonusGoal.on = true; real.group.visible = true; real.trig.enabled = true; w.goalObj = real; game.say('hotel.l20.again', { priority: 2 }); } })) game.completeLevel();
    };
    w.interactable({ x: 0, y: 1.6, z: -162.4, w: 8, h: 1.4, d: 0.8, label: () => (paid2 ? 'Desk' : 'Pay the second bill'), enabled: () => !paid2, onUse: (g) => {
      if (!cash) { game.say('hotel.l20.nocash', { priority: 2 }); return; }
      game.say('hotel.l20.bill2', { priority: 2 });
      openBill(g, { title: 'CHECKOUT · SECOND BILL', lines: [['Room (1 night)', 189], ['Resort fee', 45], ['ATM fee', 39.99], ['Late checkout (you are late)', 60], ['Fee for the fee for the fees', 13.32], ['Correction', 0]], tips: [20, 25, 30], strings: { paid: 'Processing…' }, onPay: finish2 });
    } });
    fakeExit(w, game, { x: -8, y: 0, z: -185, kind: 'door', label: 'MANAGER · EXIT', say: 'hotel.l20.closet', yaw: Math.PI / 2 });
    w.goalObj = real;

    w.hooks.onCheckpoint = (c) => { const i = cps.get(c); if (i !== undefined) stageTitle(game, w, i + 1, NAMES.length, NAMES[i]); };
    let t0 = 0, intro = false;
    w.hooks.frame = (dt, g) => { if (g.state !== 'playing') return; t0 += dt; if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l20.intro'); stageTitle(g, w, 1, NAMES.length, NAMES[0]); } };
    w.hooks.onDeath = () => { if (Math.random() < 0.6) { game.say('hotel.l20.fall', { priority: 1 }); return true; } return false; };
    stageHint(w, stages.map((s, i) => ({ at: s.at, route: [{ x: 0, y: 0, z: (stages[i + 1]?.at.z ?? -198) + 3 }] })), { end: { x: 0, y: 0, z: -198 } });
    const baseHint = w.hintFn;
    w.hintFn = (g) => { if (g.player.z < -150 && !bonusGoal.on) return [{ x: g.player.x, y: 0.15, z: g.player.z }, { x: 0, y: 1.6, z: -161 }]; return baseHint(g); };
    // the bot pays at the desks and the ATM by calling what the modal would, and walks the centre lane of the belts
    w.botPlan = (g) => {
      const p = g.player;
      if (p.z < -50 && p.z > -58 && !paid1) { finish1(); return null; }
      if (p.z < -104 && p.z > -112 && !cash) { takeCash(); return null; }
      if (p.z < -158 && p.z > -168 && cash && !paid2) { finish2(); return null; }
      if (p.z < -150 && !bonusGoal.on && paid2) return { x: p.x, z: p.z, wait: true };
      if (p.z < -58 && p.z > -104) return { x: 0, z: -106 };
      return null;
    };
    w.checkout = { finish1, takeCash, finish2, carts, get paid1() { return paid1; }, get cash() { return cash; }, get paid2() { return paid2; } };
    void glowMaterial;
  },
};
