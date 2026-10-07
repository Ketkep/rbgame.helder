import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, chandelier, GOLD } from './kit.js';
import { pickQuestion, quizHall } from './quiz.js';
import { openBill } from '../../engine/bill.js';

// Hotel level 13 — "Minibar" (Hard · Guest Rooms). A quiz where the answers are in the minibar. Open one to read your options — for a fee.
// The price on the door is a lie (plus tax, plus service, plus the resort fee, plus a convenience fee for the convenience). You start with
// $45. Hints cost money too. When the card is declined you are guessing. At the end: the bill, and a tip you cannot refuse.

const PERIOD = 16, ISLAND_D = 7, Z0 = 4, N = 5;
const START = 45;

export default {
  id: 'hotel-13',
  name: 'Minibar',
  music: 'hotel2',
  completeQuip: 'Thank you for staying with us. We have charged you for the thank-you.',

  build(w, game) {
    hotelEnv(w);
    w.spawn = { x: 0, y: 0, z: Z0 + 4.5, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -8;
    const zEnd = Z0 - N * PERIOD - 5;
    const hall = roomShell(w, { x0: -15, x1: 15, z0: zEnd - 4, z1: Z0 + 9, yb: -10, wallTex: 'panel', wallColor: 0xb8d0c8, pilasterEvery: 12 });
    w.plat({ x: 0, y: -9.5, z: hall.cz, w: 30, d: hall.D, h: 1, tex: 'carpet', color: 0x0e2a30, roughness: 0.95 });
    for (let k = 0; k <= N; k += 2) chandelier(w, 0, 9.6, Z0 + 4 - k * PERIOD, 0.8);

    // ---- the money ---------------------------------------------------------------------------------------------------------------
    let balance = START, spent = 0, opens = 0, hints = 0;
    const chip = document.createElement('div'); chip.id = 'money-chip'; document.body.appendChild(chip);
    w.onDispose(() => chip.remove());
    const showBal = () => { chip.textContent = `Balance  $${balance.toFixed(2)}`; chip.classList.toggle('neg', balance < 5); };
    showBal();
    const price = (listed) => {   // the actual charge: listed + convenience + service charge + tax + resort fee
      const conv = 1.5 + Math.round(Math.random() * 20) / 10, svc = listed * 0.18, tax = (listed + conv) * 0.09, resort = 4 + Math.round(Math.random() * 30) / 10;
      const total = Math.round((listed + conv + svc + tax + resort) * 100) / 100;
      return { listed, conv, svc, tax, resort, total };
    };
    const charge = (g, listed, what) => {
      const p = price(listed);
      if (balance < p.total) { g.audio.buzzer(); g.ui.toast(`Card declined · ${what} costs $${p.total.toFixed(2)}`, ''); g.say('hotel.l13.declined', { priority: 2 }); return false; }
      balance = Math.round((balance - p.total) * 100) / 100; spent += p.total; showBal();
      g.audio.confirm();
      g.ui.toast(`${what}: $${p.listed.toFixed(2)} (+ $${(p.total - p.listed).toFixed(2)} in fees) = $${p.total.toFixed(2)}`, 'gold');
      return true;
    };

    // ---- the quiz: answers are locked in the minibars --------------------------------------------------------------------------
    const used = new Set();
    const mk = (pools, n = 3) => pickQuestion(game, pools, { n, used });
    const quiz = quizHall(w, game, {
      Z0, period: PERIOD, islandD: ISLAND_D, hallW: 22, carpet: 0xcfe8e0,
      stages: [
        { q: mk(['f2', 'f1', 'keys']), gimmick: 'honest', lockedTags: true, header: 'ROUND 1 OF 5 · $4.00*' },
        { q: mk(['f2', 'dyn3', 'f1']), gimmick: 'lie', lockedTags: true, header: 'ROUND 2 OF 5 · $4.00*' },
        { q: mk(['dyn3', 'f2', 'f1']), gimmick: 'breathe', lockedTags: true, header: 'ROUND 3 OF 5 · $4.00*' },
        { q: mk(['f2', 'f1', 'hotel']), gimmick: 'timer', limit: 11, lockedTags: true, header: 'ROUND 4 OF 5 · 11 SECONDS' },
        { q: mk(['dyn2', 'f2', 'f1'], 4), gimmick: 'slide', lockedTags: true, header: 'FINAL ROUND · $4.00*' },
      ],
      lines: { right: 'hotel.l13.right', rightLast: 'hotel.l13.right.last', wrong: 'hotel.l13.wrong', wrongLie: 'hotel.l13.wrong.lie', hint: 'hotel.l13.hint', hintNone: 'hotel.l13.hint.none', timeUp: 'hotel.l13.timeup',
        stage: (k, st) => [`hotel.l13.s${k}`, { letter: st.lieLetter || st.correctPad.letter, text: st.correctPad.text }] },
    });
    const { stages, fin } = quiz;

    // the minibar on each island: press E, pay, read the answers
    const fridges = stages.map((st, k) => {
      const isl = quiz.islands[k], x = k % 2 ? 8.4 : -8.4, z = isl.zN + 2.6;
      const g = new THREE.Group(); g.position.set(x, 0, z); w.add(g);
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 1.2), plainMaterial(0xdfe6ea, { roughness: 0.3, metalness: 0.4 })); body.position.y = 0.65; body.castShadow = true; g.add(body);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.06), plainMaterial(0x1a2a30, { roughness: 0.1, metalness: 0.2 })); door.position.set(0, 0.65, 0.63); g.add(door);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), new THREE.MeshBasicMaterial({ color: 0x80d8ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.set(0, 0.65, 0.67); g.add(glow);
      const sign = w.sign({ text: '$4.00*', x, y: 1.9, z: z + 0.7, w: 1.7, h: 0.6, color: '#ffd890', double: false, tw: 512, size: 100, glow: true });
      void sign;
      w.plat({ x, y: 1.3, z, w: 1.7, d: 1.2, h: 1.3, tex: 'metal', color: 0xdfe6ea, roughness: 0.3, radius: 0.04 });
      const rec = { st, k, g, door, glow, opened: false };
      rec.it = w.interactable({
        x, y: 0.9, z: z + 0.3, w: 1.9, h: 1.4, d: 1.6, range: 3.6, pad: 0.1,
        label: () => (rec.opened ? 'Minibar (open)' : stages[quiz.cleared] === st ? 'Open the minibar · $4.00*' : 'Minibar (not yet)'),
        onUse: (gm) => openFridge(gm, rec),
      });
      return rec;
    });
    function openFridge(g, rec) {
      if (rec.opened || stages[quiz.cleared] !== rec.st) return;
      if (!charge(g, 4.0, 'Minibar')) return;
      rec.opened = true; opens++; rec.st.unlock();
      rec.door.rotation.y = -1.2; rec.door.position.x = 0.75; rec.door.position.z = 1.15;
      rec.glow.material.color.setHex(0xffe0a0); rec.glow.material.opacity = 0.35;
      g.say(opens === 1 ? 'hotel.l13.first' : 'hotel.l13.opened', { priority: 1 });
    }
    // hints cost money (and the price on the button is, again, wrong)
    const baseHint = w.hintAction;

    // ---- the front desk: the bill ---------------------------------------------------------------------------------------------------
    w.plat({ x: 0, y: 1.0, z: fin.zN + 2.4, w: 8, d: 1.6, h: 0.2, tex: 'marble', color: 0xece3cf, roughness: 0.2, radius: 0.05 });
    w.plat({ x: 0, y: 0.8, z: fin.zN + 2.4, w: 7.6, d: 1.3, h: 1.6, tex: 'wood', color: 0xffffff, roughness: 0.3, radius: 0.05 });
    w.box({ x: 0, y: 1.5, z: fin.zN + 2.3, w: 1.2, h: 0.8, d: 0.12, glow: 0x6cf0b2, glowIntensity: 1.2, shadow: false });
    w.sign({ text: 'CHECK OUT', x: 0, y: 4.2, z: fin.zN + 1.4, w: 7, h: 1.5, color: '#f1d28a', double: false, tw: 1024, size: 130 });
    let billOpen = false, paid = false;
    const showBill = (g) => {
      billOpen = true;
      const extras = [['Minibar restocking fee', 19.99], ['Resort fee', 24.0], ['Fee for reading this bill', 2.5], ['Fee for the fees', 6.5]];
      const lines = [[`Minibar openings (${opens})`, 0], [`Hints (${hints})`, 0]];
      lines[0][1] = Math.round((spent - hintSpent) * 100) / 100; lines[1][1] = Math.round(hintSpent * 100) / 100;
      for (const e of extras) lines.push(e);
      lines.push(['Deposit credit', -START]);
      g.say('hotel.l13.bill', { priority: 2 });
      openBill(g, {
        title: 'CHECKOUT · YOUR BILL', lines, tips: [18, 20, 25],
        strings: { noTip: 'Please select a tip. Tipping is how we say thank you.', zero: 'A tip of zero is not a tip. It is a statement.', paid: 'Paid. Thank you for your generosity!' },
        onPay: () => { paid = true; game.say('hotel.l13.done', { priority: 2 }); game.completeLevel(); },
      });
      const prev = g.modal; const origClose = prev.close; prev.close = () => { billOpen = false; origClose(); };
    };
    // hints cost money (and the price on the button is, again, wrong); tracked separately so the bill can itemise them
    let hintSpent = 0;
    const _charge = charge;
    w.hintAction = (g) => { const st = quiz.cur(); if (!st) return false; const before = spent; if (!_charge(g, 9.99, 'Hint')) return false; const ok = baseHint(g); if (ok) { hints++; hintSpent += spent - before; } else { balance = Math.round((balance + (spent - before)) * 100) / 100; spent = before; showBal(); } return ok; };
    w.interactable({ x: 0, y: 1.6, z: fin.zN + 2.3, w: 4, h: 1.2, d: 1.5, range: 4.4, label: () => (paid ? 'Paid' : 'Check out'), onUse: (g) => { if (!paid && !billOpen) showBill(g); } });

    // ---- the host ------------------------------------------------------------------------------------------------------------------------------
    let t0 = 0, intro = false;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l13.intro'); g.say('hotel.l13.intro2'); }
    };
    w.hooks.onDeath = () => false;
    w.minibar = { quiz, fridges, get balance() { return balance; }, get spent() { return spent; }, get opens() { return opens; }, get hints() { return hints; }, set balance(v) { balance = v; showBal(); }, charge: (listed) => charge(game, listed, 'Test'), openFridge: (i) => openFridge(game, fridges[i]), showBill: () => showBill(game), get paid() { return paid; } };
    // bot: pay for nothing, answer correctly (it knows which pad is right)
    const baseBot = w.botPlan;
    w.botPlan = (g) => {
      const p = g.player;
      if (!quiz.cur() && !paid) {
        if (!billOpen) { if (Math.hypot(p.x, p.z - (fin.zN + 4.2)) > 1.5) return { x: 0, z: fin.zN + 4.2 }; showBill(g); return { wait: true, x: p.x, z: p.z }; }
        if (g.modal) { g.modal.key({ code: 'Digit1' }); g.modal.key({ code: 'Enter' }); }
        return { wait: true, x: p.x, z: p.z };
      }
      return baseBot(g);
    };
    void glowMaterial; void GOLD;
  },
};
