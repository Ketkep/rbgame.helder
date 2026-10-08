import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, chandelier, GOLD } from './kit.js';
import { pickQuestion } from './quiz.js';
import { quizShow, suitcases } from './quiz-show.js';
import { openBill } from '../../engine/bill.js';
import { survey, adBreak, fakeComplete, trollCheckpoint, twistZone, vanishAfter, stageTitle } from './trolls.js';

// Hotel level 13 — "Minibar" (Hard · Guest Rooms). A quiz where the answers are in the minibars. Open one to read your options, for a fee.
// The price on the door is a lie (plus tax, plus service, plus the resort fee, plus a convenience fee for the convenience).
// You start with $80. Hints cost money too (the button is honest; the price is not). Twelve rounds, three acts, two checkout interludes.
//   1 Welcome Drink      R1 honest (a minibar) · R2 the host lies · R3 breathing pads · R4 an 11 s clock
//   2 Checkout Queue     suitcase trolleys cross the lane, a self-checkout swaps A and D, a lift runs between the lanes, a belt runs against you
//   3 The Tab            R5 sliding pads (the CARD IS DECLINED once: a survey) · R6 the audience poll lies · R7 pick a WRONG one ·
//                        R8 "None of the above" (an ad: press E to skip it for 99 cents)
//   4 Luggage Carousel   a sideways belt with bags on it, a checkpoint that rewinds you (crooked pole, off the path), a quick-release plank
//   5 Settling Up        R9 double or nothing · R10 the question changes (a minibar) · R11 the host changes his mind · R12 nobody can know: PASS
//                        → the desk: the bill, with a tip you cannot refuse → CHECKED OUT! …just kidding
//   6 Late Fees          (only once the desk has lied) a gauntlet of fees to the corrections desk: a second bill, a bigger tip
// Baby Mode: the clock is slower, wrong pads wobble long enough to hop off, nothing changes after you sign, the swap/mirror twists are short,
// the rewind checkpoint keeps your save, the quick-release plank waits longer.

const NAMES = ['Welcome Drink', 'Checkout Queue', 'The Tab', 'Luggage Carousel', 'Settling Up', 'Late Fees'];
const NQ = 12;
const START = 80;
const DECLINE_ROUND = 4;     // the one minibar whose card is "declined"

export default {
  id: 'hotel-13',
  name: 'Minibar',
  music: 'hotel2',
  completeQuip: 'Thank you for staying with us. We have charged you for the thank-you.',

  build(w, game) {
    hotelEnv(w);
    const Z0 = 12;
    w.spawn = { x: 0, y: 0, z: Z0 - 1.8, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -6;
    const zFar = -420;
    const hall = roomShell(w, { x0: -15, x1: 15, z0: zFar, z1: Z0 + 4, yb: -10, wallTex: 'panel', wallColor: 0xb8d0c8, pilasterEvery: 12, beamEvery: 12 });
    w.plat({ x: 0, y: -9.5, z: hall.cz, w: 30, d: hall.D, h: 1, tex: 'carpet', color: 0x0e2a30, roughness: 0.95 });
    for (const z of [Z0 - 6, -60, -120, -190, -260, -330, -390]) chandelier(w, 0, 9.6, z, 0.8);

    // ---- the money --------------------------------------------------------------------------------------------------------------------
    let balance = START, spent = 0, opens = 0, hints = 0, hintSpent = 0, declined = false, skipped = 0;
    const chip = document.createElement('div'); chip.id = 'money-chip'; document.body.appendChild(chip);
    w.onDispose(() => chip.remove());
    const showBal = () => { chip.textContent = `Balance  $${balance.toFixed(2)}`; chip.classList.toggle('neg', balance < 12); };
    showBal();
    const price = (listed) => {   // the actual charge: listed + convenience + service charge + tax + resort fee
      const conv = 1.5 + Math.round(Math.random() * 20) / 10, svc = listed * 0.18, tax = (listed + conv) * 0.09, resort = 4 + Math.round(Math.random() * 30) / 10;
      const total = Math.round((listed + conv + svc + tax + resort) * 100) / 100;
      return { listed, conv, svc, tax, resort, total };
    };
    const charge = (g, listed, what, { quiet = false } = {}) => {
      const p = price(listed);
      if (balance < p.total) { if (!quiet) { g.audio.buzzer(); g.ui.toast(`Card declined · ${what} costs $${p.total.toFixed(2)}`, ''); g.say('hotel.l13.declined', { priority: 2 }); } return false; }
      balance = Math.round((balance - p.total) * 100) / 100; spent += p.total; showBal();
      g.audio.confirm();
      g.ui.toast(`${what}: $${p.listed.toFixed(2)} (+ $${(p.total - p.listed).toFixed(2)} in fees) = $${p.total.toFixed(2)}`, 'gold');
      return p.total;
    };

    // ---- the show ----------------------------------------------------------------------------------------------------------------------
    const show = quizShow(w, game, { prefix: 'hotel.l13', names: NAMES, z0: Z0, hallW: 22, carpet: 0xcfe8e0 });
    const used = new Set();
    const ask = (pools, n = 3) => pickQuestion(game, pools, { used, n });
    const deck = (o) => w.plat({ tex: 'marble', color: 0xdfe9e4, roughness: 0.2, radius: 0.05, ...o });
    const belt = (o, v) => w.conveyor(w.plat({ tex: 'metal', color: 0x3a3440, roughness: 0.5, ...o }), v);
    const H = (n, extra = '') => `ROUND ${n} OF ${NQ}${extra}`;
    const bonusPlats = [], bonusMeshes = [];
    const fridges = [];
    const lockedRound = (spec) => { const st = show.round({ ...spec, locked: true, header: (spec.header || '') + ' · $4.00*' }); return st; };

    // ===== 1 · Welcome Drink ==========================================================================================
    show.stage(NAMES[0], { flag: false });
    const r1 = lockedRound({ q: ask(['f2', 'f1', 'keys']), claim: 'right', say: 'hotel.l13.r.honest', header: H(1) });
    show.round({ q: ask(['f2', 'dyn3', 'f1']), claim: 'lie', say: 'hotel.l13.r.lie', header: H(2) });
    show.round({ q: ask(['dyn3', 'f2', 'f1']), breathe: true, say: 'hotel.l13.r.breathe', header: H(3) });
    show.round({ q: ask(['f2', 'f1', 'hotel']), timer: 11, stones: 1, say: 'hotel.l13.r.timer', header: H(4, ' · 11 SECONDS') });

    // ===== 2 · Checkout Queue =========================================================================================
    let z = show.z;
    const dockA = deck({ x: 0, y: 0, z: z - 2.5, w: 9, d: 5, h: 0.6 });
    show.pillars(0, -0.6, z - 2.5, 9, 5);
    show.stage(NAMES[1], { at: { x: 0, y: 0, z: z - 2.5 }, say: 'hotel.l13.queue', width: 9 });
    show.route(dockA);
    const lane1 = deck({ x: 0, y: 0, z: z - 13.0, w: 5, d: 16, h: 0.5, tex: 'carpet', color: 0x7a1030, roughness: 0.9 });
    show.pillars(0, -0.5, z - 13.0, 5, 16);
    stanchions(w, 0, z - 13.0, 5, 16);
    show.route(lane1);
    const tr1 = trolleyHazard(w, 0, 0.2, z - 12.5, 4.6, (t) => ({ z: 2.4 * Math.sin(t * 0.55) }));
    const tr2 = null;
    twistZone(game, w, { x: 0, y: 1.2, z: z - 13.0, w: 7, h: 2.6, d: 16 }, 'swap', { sec: 6, say: 'hotel.l13.glitch' });
    const slider = deck({ x: 0, y: 0, z: z - 24.2, w: 3.6, d: 3.4, h: 0.4, tex: 'brass', color: 0xffffff, metalness: 0.9, roughness: 0.3 });
    w.mover(slider, (t) => ({ x: 3.6 - 3.6 * Math.cos(t * 0.7) }));    // 0 .. 7.2 and back
    for (const zz of [-22.4, -26.0]) w.box({ x: 3.6, y: -0.3, z: z + zz, w: 8.4, h: 0.1, d: 0.1, color: GOLD, metal: 1, rough: 0.3, shadow: false });
    w.sign({ text: 'NEXT PLEASE ▸', x: 3.6, y: 0.02, z: z - 21.6, w: 3.4, h: 0.6, rotX: -Math.PI / 2, color: '#f1d28a', double: false, tw: 1024, size: 60 });
    const lane2 = belt({ x: 7.2, y: 0, z: z - 33.6, w: 4.6, d: 12, h: 0.5 }, { vz: 2.6 });
    show.pillars(7.2, -0.5, z - 33.6, 4.6, 12, { r: 0.22 });
    stanchions(w, 7.2, z - 33.6, 4.6, 12);
    const tr3 = trolleyHazard(w, 7.2, 0.2, z - 33.6, 4.2, (t) => ({ z: 2.2 * Math.sin(t * 0.6) }));
    const endA = deck({ x: 7.2, y: 0, z: z - 42.8, w: 6, d: 4, h: 0.6 });
    show.pillars(7.2, -0.6, z - 42.8, 6, 4);
    const zA = z;
    show.route(slider, { wait: () => slider.body.x > 2.0 && game.player.z < zA - 19.2, ride: () => slider.body.x < 5.4 });
    show.route(lane2);
    show.route(endA);
    show.z = z - 46.6;
    void tr1; void tr2; void tr3;

    // ===== 3 · The Tab ================================================================================================
    show.stage(NAMES[2], { say: 'hotel.l13.tab' });
    const r5 = lockedRound({ q: ask(['dyn3', 'f2', 'hotel']), slide: 1.3, say: 'hotel.l13.r.slide', header: H(5) });
    show.round({ q: ask(['hotel', 'host', 'sense']), poll: true, say: 'hotel.l13.r.poll', header: H(6) });
    show.round({ q: ask(['keys', 'sense']), flip: true, say: 'hotel.l13.r.flip', sayWrong: 'hotel.l13.wrong.flip', header: 'ROUND 7 · PICK A WRONG ANSWER' });
    let adOn = false, skipKey = null;
    const r8 = lockedRound({ q: ask(['none']), none: true, say: 'hotel.l13.ad', header: H(8),
      onEnter: () => {
        adOn = true; adBreak(game, w, { sec: 5, sayAfter: 'hotel.l13.r.none' });
        setTimeout(() => { adOn = false; }, game.baby ? 3000 : 5000);
      } });
    skipKey = (e) => {   // pay to skip the ad
      if (!adOn || e.code !== 'KeyK' || game.state !== 'playing') return;
      if (!charge(game, 0.99, 'Skip ad')) return;
      adOn = false; skipped++; game.ui.ad(false); game.say('hotel.l13.skip', { priority: 2 });
    };
    window.addEventListener('keydown', skipKey);
    w.onDispose(() => window.removeEventListener('keydown', skipKey));

    // ===== 4 · Luggage Carousel =======================================================================================
    z = show.z;
    const zC = z;
    const dockB = deck({ x: 0, y: 0, z: z - 2.5, w: 9, d: 5, h: 0.6 });
    show.pillars(0, -0.6, z - 2.5, 9, 5);
    show.stage(NAMES[3], { at: { x: 0, y: 0, z: z - 2.5 }, say: 'hotel.l13.carousel', width: 9 });
    show.route(dockB);
    const carousel = belt({ x: 0, y: 0, z: z - 13.5, w: 8, d: 14, h: 0.4 }, { vx: -2.0 });
    show.pillars(0, -0.4, z - 13.5, 8, 14, { r: 0.22 });
    const bags = [0, 1].map((i) => bagHazard(w, 0, 0.2, z - 11.0 - i * 7.0, (t) => ({ x: 4.3 - ((t * 2.0 + i * 4.3) % 8.6) })));
    show.route(carousel);
    const rest = deck({ x: 0, y: 0, z: z - 24.5, w: 7, d: 4, h: 0.6 });
    show.pillars(0, -0.6, z - 24.5, 7, 4);
    show.route(rest);
    // the lure: a save point off the path, with a crooked pole (and a host who is much too keen)
    const lure = deck({ x: -6.6, y: 0, z: z - 24.5, w: 3.4, d: 3.4, h: 0.6 });
    show.pillars(-6.6, -0.6, z - 24.5, 3.4, 3.4);
    w.sign({ text: 'SAVE POINT ★', x: -6.6, y: 0.32, z: z - 26.2, w: 3.0, h: 0.5, rotX: -Math.PI / 2, color: '#6cf0b2', double: false, tw: 512, size: 56 });
    trollCheckpoint(w, game, { x: -6.6, y: 0, z: z - 24.5, mode: 'rewind', back: { x: 0, y: 0, z: z - 2.5 }, say: 'hotel.l13.rewind' });
    onceNear(w, game, { x: -6.6, z: z - 24.5 }, 9, 'hotel.l13.lure');
    const plank = deck({ x: 0, y: 0, z: z - 31.5, w: 2.2, d: 6.5, h: 0.4 });
    vanishAfter(w, game, plank, { axis: 'z', dir: -1, frac: 0.55, delay: 0.8, back: 3.2, say: 'hotel.l13.vanish' });
    show.route(plank);
    const endB = deck({ x: 0, y: 0, z: z - 38.5, w: 9, d: 4, h: 0.6 });
    show.pillars(0, -0.6, z - 38.5, 9, 4);
    show.route(endB, { save: { x: 0, y: 0, z: z - 38.5 } });
    show.z = z - 42.5;

    // ===== 5 · Settling Up ============================================================================================
    show.stage(NAMES[4], { say: 'hotel.l13.settle' });
    show.round({ q: ask(['two'], 4), double: true, say: 'hotel.l13.r.double', header: H(9, ' · DOUBLE OR NOTHING') });
    const swQ = ask(['f2', 'f1', 'hotel']);
    const r10 = lockedRound({ q: ask(['keys', 'hotel']), switch: swQ, say: 'hotel.l13.r.switch', header: H(10) });
    show.round({ q: ask(['sense', 'host']), mind: true, say: 'hotel.l13.r.mind', header: H(11) });
    show.round({ q: ask(['unknowable']), pass: true, say: 'hotel.l13.r.pass', header: H(12, ' · LAST ONE') });

    // ---- the front desk: the bill (and the second bill) ---------------------------------------------------------------
    z = show.z;
    const lobby = deck({ x: 0, y: 0, z: z - 6, w: 20, d: 12, h: 1.4, tex: 'carpet', color: 0x0e4a52 });
    show.pillars(0, -1.4, z - 6, 18, 12);
    show.route(lobby, { save: { x: 0, y: 0, z: z - 2.5 } });
    const deskX = -5, deskZ = z - 9.2;
    deskCounter(w, deskX, deskZ, 'CHECK OUT');
    suitcases(w, 8, 0, z - 3, { n: 3, seed: 31 });
    let billOpen = false, paid = false, paid2 = false, bonusOn = false;
    const bill1Lines = () => {
      const extras = [['Minibar restocking fee', 19.99], ['Resort fee', 24.0], ['Fee for reading this bill', 2.5], ['Fee for the fees', 6.5]];
      const lines = [[`Minibar openings (${opens})`, Math.round((spent - hintSpent) * 100) / 100], [`Hints (${hints})`, Math.round(hintSpent * 100) / 100]];
      if (skipped) lines.push([`Ad skips (${skipped}) — included above`, 0]);
      lines[0][1] = Math.round(Math.max(0, spent - hintSpent) * 100) / 100;
      for (const e of extras) lines.push(e);
      lines.push(['Deposit credit', -START]);
      return lines;
    };
    const modalBill = (g, o) => {
      billOpen = true;
      const b = openBill(g, o);
      const prev = g.modal, origClose = prev.close; prev.close = () => { billOpen = false; origClose(); };
      return b;
    };
    const showBill = (g) => {
      if (paid || billOpen) return;
      g.say('hotel.l13.bill', { priority: 2 });
      modalBill(g, {
        title: 'CHECKOUT · YOUR BILL', lines: bill1Lines(), tips: [18, 20, 25],
        strings: { noTip: 'Please select a tip. Tipping is how we say thank you.', zero: 'A tip of zero is not a tip. It is a statement.', paid: 'Paid. Thank you for your generosity!' },
        onPay: () => {
          if (paid) return;
          paid = true; billOpen = false;
          if (!fakeComplete(game, w, { title: 'CHECKED OUT!', sub: 'Minibar · Paid in full', say: 'hotel.l13.fakewin', then: openBonus })) { game.say('hotel.l13.done', { priority: 2 }); game.completeLevel(); }
        },
      });
    };
    const showBill2 = (g) => {
      if (paid2 || billOpen || !bonusOn) return;
      g.say('hotel.l13.bill2', { priority: 2 });
      modalBill(g, {
        title: 'CORRECTED BILL', tips: [20, 25, 30],
        lines: [['Corrected minibar total', Math.round(spent * 100) / 100], ['Late fee', 14.5], ['Fee for the correction', 9.0], ['Fee for the fee for the correction', 3.5], ['Refund of the previous tip', -0.0], ['Deposit credit (already used)', 0]],
        strings: { noTip: 'The tip is required. It is corrected, too.', zero: 'Zero is not a tip. It is a corrected statement.', paid: 'Paid. Again. Thank you for the second helping of your generosity!' },
        onPay: () => { if (paid2) return; paid2 = true; billOpen = false; game.say('hotel.l13.done', { priority: 2 }); game.completeLevel(); },
      });
    };
    const deskIt = w.interactable({ x: deskX, y: 1.6, z: deskZ, w: 5, h: 1.4, d: 2.4, range: 4.4, label: () => (paid ? 'Paid' : 'Check out'), onUse: (g) => { if (!paid && !billOpen) showBill(g); } });
    void deskIt;

    // ===== 6 · Late Fees (only there once the desk has lied to you) ======================================================
    const zL = z;
    const lf = (o, tint = 0xeadcc4) => { const p = deck({ ...o, color: tint }); bonusPlats.push(p); return p; };
    const lf0 = lf({ x: 0, y: 0, z: z - 16.5, w: 6, d: 4, h: 0.6 });
    bonusMeshes.push(...show.pillars(0, -0.6, z - 16.5, 6, 4));
    const lf1 = lf({ x: 0, y: 0, z: z - 22.5, w: 3.4, d: 3, h: 0.4 }); w.crumble(lf1, { delay: 0.7, gone: 3 });
    bonusMeshes.push(...show.pillars(0, -0.4, z - 22.5, 3.4, 3, { r: 0.18 }));
    const lf2 = lf({ x: 0, y: 0, z: z - 28.2, w: 3.4, d: 3, h: 0.4 }); w.mover(lf2, (t) => ({ x: 2.6 * Math.sin(t * 0.9) }));
    const lf3 = lf({ x: 0, y: 0, z: z - 36.0, w: 2.2, d: 6.5, h: 0.4 });
    vanishAfter(w, game, lf3, { axis: 'z', dir: -1, frac: 0.55, delay: 0.8, back: 3.2, say: 'hotel.l13.vanish' });
    const deskB = lf({ x: 0, y: 0, z: z - 45.0, w: 14, d: 8, h: 0.6 }, 0xdfe9e4);
    bonusMeshes.push(...show.pillars(0, -0.6, z - 45.0, 14, 8));
    const lateSign = w.sign({ text: 'LATE FEES ▸', x: 0, y: 0.02, z: z - 14.6, w: 4, h: 0.7, rotX: -Math.PI / 2, color: '#ff9a8a', double: false, tw: 1024, size: 60 }); bonusMeshes.push(lateSign);
    const stage6 = show.stage(NAMES[5], { at: { x: 0, y: 0, z: z - 16.5 }, say: 'hotel.l13.late', width: 6 });
    show.route(lf0); show.route(lf1); show.route(lf2, { ride: () => Math.abs(lf2.body.x) < 1.4 }); show.route(lf3); show.route(deskB, { save: { x: 0, y: 0, z: z - 45.0 } });
    const deskGroup = new THREE.Group(); w.add(deskGroup);
    const desk2 = deskCounter(w, 4, z - 48.0, 'CORRECTIONS', deskGroup);
    bonusMeshes.push(deskGroup);
    const desk2It = w.interactable({ x: 4, y: 1.6, z: z - 48.0, w: 5, h: 1.4, d: 2.4, range: 4.4, label: () => (paid2 ? 'Paid (again)' : 'Pay the corrected bill'), onUse: (g) => { if (bonusOn && !paid2 && !billOpen) showBill2(g); } });
    void desk2; void desk2It;
    show.z = z - 56;
    const setBonus = (on) => {
      for (const p of bonusPlats) p.setEnabled(on);
      for (const m of bonusMeshes) m.visible = on;
      if (stage6.cp) stage6.cp.group.visible = on;
    };
    setBonus(false);
    function openBonus() {
      bonusOn = true;
      setBonus(true);
      w.burst(new THREE.Vector3(0, 0.6, zL - 16.5), GOLD, 14, 3);
      game.say('hotel.l13.correction', { priority: 2 });
    }

    // ---- the minibars: press E, pay, read the answers ----------------------------------------------------------------
    for (const st of show.rounds) {
      if (!st.spec.locked) continue;
      const k = st.k, x = k % 2 ? 7.2 : -7.2, zz = st.zN + 2.6;
      const g = new THREE.Group(); g.position.set(x, 0, zz); w.add(g);
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 1.2), plainMaterial(0xdfe6ea, { roughness: 0.3, metalness: 0.4 })); body.position.y = 0.65; body.castShadow = true; g.add(body);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.06), plainMaterial(0x1a2a30, { roughness: 0.1, metalness: 0.2 })); door.position.set(0, 0.65, 0.63); g.add(door);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), new THREE.MeshBasicMaterial({ color: 0x80d8ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.set(0, 0.65, 0.67); g.add(glow);
      w.sign({ text: '$4.00*', x, y: 1.9, z: zz + 0.7, w: 1.7, h: 0.6, color: '#ffd890', double: false, tw: 512, size: 100, glow: true });
      w.plat({ x, y: 1.3, z: zz, w: 1.7, d: 1.2, h: 1.3, tex: 'metal', color: 0xdfe6ea, roughness: 0.3, radius: 0.04 });
      const rec = { st, k, x, z: zz, g, door, glow, opened: false, declines: 0 };
      rec.it = w.interactable({
        x, y: 0.9, z: zz + 0.3, w: 1.9, h: 1.4, d: 1.6, range: 3.6, pad: 0.1,
        label: () => (rec.opened ? 'Minibar (open)' : show.live() === st ? 'Open the minibar · $4.00*' : 'Minibar (not yet)'),
        onUse: (gm) => openFridge(gm, rec),
      });
      fridges.push(rec);
    }
    const fridgeOf = (st) => fridges.find((f) => f.st === st);
    function openFridge(g, rec) {
      if (rec.opened || show.live() !== rec.st || g.state !== 'playing') return;
      if (rec.k === DECLINE_ROUND && !declined) {   // the card is "declined" the first time, whatever is in it
        declined = true; g.audio.buzzer(); g.ui.toast('Card declined', '');
        survey(g, w, { title: 'CARD DECLINED', lines: ['Your card was declined.', 'How do you feel about that? 1 – 5', 'There is no 0. We checked.'], thanks: 'Thank you! Your feelings have been billed.', say: 'hotel.l13.card' });
        return;
      }
      let ok = charge(g, 4.0, 'Minibar');
      if (!ok) {
        rec.declines++;
        if (rec.declines >= 2) { ok = true; g.say('hotel.l13.comp', { priority: 2 }); }   // the host takes pity (and adds a line to the bill)
        else return;
      }
      rec.opened = true; opens++; rec.st.unlock();
      rec.door.rotation.y = -1.2; rec.door.position.x = 0.75; rec.door.position.z = 1.15;
      rec.glow.material.color.setHex(0xffe0a0); rec.glow.material.opacity = 0.35;
      if (ok !== true) g.say(opens === 1 ? 'hotel.l13.first' : 'hotel.l13.opened', { priority: 1 });
    }

    show.reveal();   // (tags of the locked rounds start hidden)

    // ---- hints cost money (and the price on the button is, again, wrong); the hint itself is honest -------------------------
    const baseHint = w.hintAction;
    w.hintAction = (g) => {
      if (!show.inRound()) return baseHint(g);
      const st = show.live(), before = st.hints;
      const cost = charge(g, 9.99, 'Hint');
      if (!cost) return false;
      const ok = baseHint(g);
      if (ok && st.hints > before) { hints++; hintSpent += cost; }
      else { balance = Math.round((balance + cost) * 100) / 100; spent = Math.round((spent - cost) * 100) / 100; showBal(); }
      return ok;
    };

    // ---- the host --------------------------------------------------------------------------------------------------------------------
    show.onStage = (i) => { void i; };
    onLand(w, game, lobby, 'hotel.l13.desk');
    let intro = false, t0 = 0, lastWrong = -9;
    for (const st of show.rounds) { const o = st.spec.onWrong; st.spec.onWrong = (s, p) => { lastWrong = w.t; o?.(s, p); }; }
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) {
        intro = true;
        g.say('hotel.l13.intro'); g.say('hotel.l13.intro2');
        g.say('hotel.l13.r.honest', { vars: { letter: r1.claim } });
        stageTitle(g, w, 1, NAMES.length, NAMES[0]);
      }
    };
    w.hooks.onDeath = ({ deaths }) => {
      if (w.t - lastWrong < 4) return true;
      if (deaths === 3) { game.say('hotel.l13.die.count', { priority: 1, vars: { n: deaths } }); return true; }
      const s = show.curStage();
      if (s === 1) { game.say('hotel.l13.die.queue', { priority: 1 }); return true; }
      if (s === 3) { game.say('hotel.l13.die.carousel', { priority: 1 }); return true; }
      return false;
    };
    const baseTrail = w.hintFn;
    const pt = (o, dy = 0.15) => ({ x: o.x, y: (o.y || 0) + dy, z: o.z });
    w.hintFn = (g) => {
      const p = g.player;
      if (show.cleared >= NQ && !paid) return [pt(p), { x: deskX + 1, y: 0.15, z: deskZ + 3 }];
      if (bonusOn && !paid2) return [pt(p), { x: 0, y: 0.15, z: zL - 16.5 }, { x: 0, y: 0.15, z: zL - 28.2 }, { x: 0, y: 0.15, z: zL - 36 }, { x: 4, y: 0.15, z: zL - 45.5 }];
      return baseTrail(g);
    };

    // ---- the bot: pay for the minibars (the runner answers), take the bills ----------------------------------------------------------
    w.botPlan = (g) => {
      const p = g.player, base = show.bot(g), hold = { wait: true, x: p.x, z: p.z };
      if (g.frozen) return base;
      if (g.modal) {
        if (billOpen) { g.modal.key({ code: 'Digit1' }); g.modal.key({ code: 'Enter' }); return hold; }
        return base;
      }
      const st = show.live();
      if (st && !st.hidden && st.spec.locked && !st.unlocked && p.grounded && p.ground === st.isl.body) {
        const rec = fridgeOf(st);
        if (rec) {
          if (Math.hypot(p.x - rec.x, p.z - (rec.z + 1.4)) > 1.2) return { x: rec.x, z: rec.z + 1.4 };
          openFridge(g, rec); return hold;
        }
      }
      if (st && !st.hidden && st.spec.locked && st.unlocked && p.grounded && p.ground === st.isl.body && p.z > st.zN + 1.4) {   // back to the middle, then straight at the pads
        const r = st.pads.find((q) => q.correct && !q.pass) || st.pads[0];
        return { x: r.plat.body.x * 0.5, z: st.zN + 1.0 };
      }
      if (show.cleared >= NQ && !paid) {
        if (Math.hypot(p.x - (deskX + 1), p.z - (deskZ + 3)) > 1.4) return { x: deskX + 1, z: deskZ + 3 };
        showBill(g); return hold;
      }
      if (bonusOn && !paid2 && !billOpen) {
        const n = show.nodes();
        void n;
        if (p.grounded && p.ground === deskB.body) {
          if (Math.hypot(p.x - 4, p.z - (zL - 45.5)) > 1.6) return { x: 4, z: zL - 45.5 };
          showBill2(g); return hold;
        }
      }
      return base;
    };
    w.minibar = { show, quiz: show, fridges, get balance() { return balance; }, get spent() { return spent; }, get opens() { return opens; }, get hints() { return hints; }, set balance(v) { balance = v; showBal(); },
      charge: (listed) => charge(game, listed, 'Test'), openFridge: (i) => openFridge(game, fridges[i]), showBill: () => showBill(game), showBill2: () => showBill2(game),
      get paid() { return paid; }, get paid2() { return paid2; }, get bonusOn() { return bonusOn; }, get declined() { return declined; }, r5, r8, r10, lure, slider, carousel, plank, deskB, lobby, bags, lf2, lf3, belt: lane2, skip: () => skipKey({ code: 'KeyK' }), setAd: (v) => { adOn = v; } };
    void glowMaterial;
  },
};

// ---- pieces ------------------------------------------------------------------------------------------------------------
function onLand(w, game, plat, key) {
  let said = false;
  w.onUpdate(() => { if (!said && game.state === 'playing' && game.player.grounded && game.player.ground === plat.body) { said = true; game.say(key, { priority: 1 }); } });
}
/** Say a line once when the player first comes within `r` of a spot. */
function onceNear(w, game, at, r, key) {
  let said = false;
  w.onUpdate(() => { if (!said && game.state === 'playing' && Math.hypot(game.player.x - at.x, game.player.z - at.z) < r) { said = true; game.say(key, { priority: 1 }); } });
}
/** Red velvet ropes on brass posts down both sides of a queue lane. */
function stanchions(w, x, z, wd, len) {
  const brass = plainMaterial(GOLD, { metalness: 1, roughness: 0.28 }), rope = plainMaterial(0x9a1226, { roughness: 0.6 });
  const n = Math.floor(len / 3);
  for (const sx of [-1, 1]) {
    const px = x + sx * (wd / 2 + 0.05);
    for (let i = 0; i <= n; i++) {
      const zz = z - len / 2 + (i * len) / n;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.95, 8), brass); post.position.set(px, 0.5, zz); post.matrixAutoUpdate = false; post.updateMatrix(); w.add(post);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), brass); ball.position.set(px, 1.0, zz); ball.matrixAutoUpdate = false; ball.updateMatrix(); w.add(ball);
      if (i < n) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len / n, 6), rope); r.rotation.x = Math.PI / 2; r.position.set(px, 0.85, zz - len / n / 2); r.matrixAutoUpdate = false; r.updateMatrix(); w.add(r); }
    }
  }
}
/** A luggage trolley sliding across the lane: a low, hop-able hazard (about knee high). */
function trolleyHazard(w, x, y, z, wd, move) {
  const hz = w.hazard({ x, y, z, w: wd, h: 0.4, d: 0.5, color: 0xff5a4a, move });
  hz.core.visible = false; hz.shell.visible = false; hz.jumpable = true;
  const brass = plainMaterial(GOLD, { metalness: 1, roughness: 0.3 }), red = plainMaterial(0xb0283a, { roughness: 0.6 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(wd, 0.08, 0.3), brass); bar.position.y = -0.14; hz.group.add(bar);
  for (let i = 0; i < 3; i++) { const bag = new THREE.Mesh(new THREE.BoxGeometry(wd / 3.4, 0.3, 0.45), i === 1 ? red : plainMaterial(0x1a2a4a, { roughness: 0.6 })); bag.position.set((i - 1) * (wd / 3), 0.02, 0); hz.group.add(bag); }
  const glow = new THREE.Mesh(new THREE.BoxGeometry(wd + 0.1, 0.04, 0.6), glowMaterial(0xff5a4a, 1.2)); glow.position.y = -0.19; hz.group.add(glow);
  return hz;
}
/** A suitcase riding the carousel belt: a low, hop-able hazard. */
function bagHazard(w, x, y, z, move) {
  const hz = w.hazard({ x, y, z, w: 1.4, h: 0.4, d: 1.0, color: 0xff5a4a, move });
  hz.core.visible = false; hz.shell.visible = false; hz.jumpable = true;
  const bag = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.36, 0.9), plainMaterial([0x6a3a22, 0x1a2a4a, 0x4a1a22][Math.floor(Math.random() * 3)], { roughness: 0.5 })); hz.group.add(bag);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.92), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); hz.group.add(strap);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 1.1), glowMaterial(0xff5a4a, 1.2)); glow.position.y = -0.2; hz.group.add(glow);
  return hz;
}
/** The reception counter (scenery with a solid top you can hop onto). `into` collects the meshes (so a hidden counter can be hidden). */
function deskCounter(w, x, z, text, into = null) {
  const add = (m) => { (into || w.scene).add(m); return m; };
  w.collider({ x, y: 0.6, z, w: 6.2, h: 1.2, d: 1.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(6, 1.1, 1.4), plainMaterial(0x5a3a22, { roughness: 0.3 })); body.position.set(x, 0.55, z); add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.08, 1.7), plainMaterial(0xece3cf, { roughness: 0.1 })); top.position.set(x, 1.14, z); add(top);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(6.3, 1.5, 0.08), plainMaterial(0x1a1018, { roughness: 0.5 })); panel.position.set(x, 4.0, z - 1.15); add(panel);
  const sign = w.sign({ text, x, y: 4.0, z: z - 1.09, w: 6, h: 1.3, color: '#f1d28a', double: false, tw: 1024, size: 120 }); if (into) { w.scene.remove(sign); into.add(sign); }
  const g = plainMaterial(GOLD, { metalness: 1, roughness: 0.15 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.05, 16), g); base.position.set(x + 2.4, 1.2, z); add(base);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), g); dome.position.set(x + 2.4, 1.22, z); add(dome);
  return body;
}
