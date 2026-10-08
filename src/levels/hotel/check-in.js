import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, chandelier, GOLD } from './kit.js';
import { pickQuestion } from './quiz.js';
import { quizShow, suitcases } from './quiz-show.js';
import { survey, adBreak, fakeComplete, trollCheckpoint, twistZone, stageTitle } from './trolls.js';

// Hotel level 2 — "Check-In" (Easy · Mezzanine). A registration desk that will not stop asking. Nine questions in four acts,
// one twist per question, two interludes, and a front desk that says you are done when you are not.
//   1 Registration      Q1 honest · Q2 the host lies (too confident) · Q3 the pads slide          → a survey: "How are we doing?"
//   2 Luggage Trolleys  a trolley shuttle, a FAKE checkpoint (crooked pole), suitcase stairs, a trolley that rolls off with you
//   3 The Small Print   Q4 a 15 s clock · Q5 an ad over the board, and "None of the above" · Q6 PICK A WRONG ANSWER
//   4 Revolving Door    ride the door round; it swaps A and D on the way
//   5 Last Questions    Q7 two right answers (the host says one is a trap) · Q8 the host changes his mind after you sign
//                       → the desk: CHECKED IN! (…just kidding)
//   6 The Register      suitcase steps to the guest register · Q9 "Do you trust me?" · the real goal
// Baby Mode: the clock is slower, wrong pads wobble long enough to hop off, the fake checkpoint counts, the swap is short,
// the host does not change his mind.

const NAMES = ['Registration', 'Luggage Trolleys', 'The Small Print', 'Revolving Door', 'Last Questions', 'The Register'];
const L = ['A', 'B', 'C', 'D'];

export default {
  id: 'hotel-2',
  name: 'Check-In',
  music: 'hotel',
  completeQuip: 'You\'re checked in. The room is a lie. The form was real.',

  build(w, game) {
    hotelEnv(w);
    const Z0 = 12;
    w.spawn = { x: 0, y: 0, z: Z0 - 1.8, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -6;
    const zFar = -222;
    const hall = roomShell(w, { x0: -13, x1: 13, z0: zFar, z1: Z0 + 4, yb: -10, wallTex: 'damask', wallColor: 0xffffff, pilasterEvery: 14, beamEvery: 12 });
    w.plat({ x: 0, y: -9.5, z: hall.cz, w: 26, d: hall.D, h: 1, tex: 'carpet', color: 0x3a0e18, roughness: 0.95 });
    for (const z of [Z0 - 6, -40, -90, -140, -190]) chandelier(w, 0, 9.6, z, 0.8);

    const show = quizShow(w, game, { prefix: 'hotel.l2', names: NAMES, z0: Z0, hallW: 22, carpet: 0xf3e6d0 });
    const used = new Set();
    const ask = (pools, n = 3) => pickQuestion(game, pools, { used, n });
    const deck = (o) => w.plat({ tex: 'marble', color: 0xece3cf, roughness: 0.2, radius: 0.05, ...o });
    const leather = (o) => w.plat({ tex: 'leather', roughness: 0.5, radius: 0.08, ...o });

    // ===== 1 · Registration ===========================================================================================
    show.stage(NAMES[0], { flag: false });
    const r1 = show.round({ q: ask(['keys']), claim: 'right', header: 'QUESTION 1 OF 9' });
    show.round({ q: ask(['hotel', 'host']), claim: 'lie', say: 'hotel.l2.r.lie', header: 'QUESTION 2 OF 9' });
    show.round({ q: ask(['sense']), slide: 1.3, say: 'hotel.l2.r.slide', header: 'QUESTION 3 OF 9' });

    // ===== 2 · Luggage Trolleys ======================================================================================
    let z = show.z;                               // the gap after question 3's gate starts here
    const dock = deck({ x: 0, y: 0, z: z - 2.5, w: 9, d: 5, h: 0.6 });
    show.pillars(0, -0.6, z - 2.5, 9, 5);
    show.stage(NAMES[1], { at: { x: 0, y: 0, z: z - 2.5 }, say: 'hotel.l2.trolleys' });
    show.route(dock);
    suitcases(w, -3.4, 0, z - 3.6, { n: 3, seed: 2 }); suitcases(w, 3.5, 0, z - 1.4, { n: 2, seed: 5 });
    w.sign({ text: 'LUGGAGE ▸ THIS WAY', x: 0, y: 0.02, z: z - 1.2, w: 4.4, h: 0.8, rotX: -Math.PI / 2, color: '#f1d28a', double: false, tw: 1024, size: 80 });
    // a shuttle trolley on rails: rides you from the dock to the suitcases
    const shZ = z - 10.2;
    const shuttle = trolley(w, 0, 0, shZ, 2.6, 2.4);
    w.mover(shuttle, (t) => ({ z: 2.7 * Math.sin(t * 0.75) }));
    rails(w, show, 0, -1.05, shZ, 2.6, 9);
    const pile = leather({ x: 0, y: 0, z: z - 17.4, w: 6, d: 3.4, h: 0.5, color: 0x5a2a1a });
    show.pillars(0, -0.5, z - 17.4, 6, 3.4, { color: 0x3a2a20 });
    suitcases(w, -2.2, 0, z - 18.2, { n: 4, seed: 3 }); suitcases(w, 2.3, 0, z - 18.4, { n: 2, seed: 9 });
    show.route(shuttle, { wait: (g) => shuttle.body.z < shZ + 2.0, ride: (g) => shuttle.body.z > shZ - 2.2 && g.player.z > shZ - 3 });
    show.route(pile);
    const fakeCp = trollCheckpoint(w, game, { x: 0, y: 0, z: z - 17.2, mode: 'fake' });             // the pole is a hair crooked
    void fakeCp;
    // suitcase stairs
    const s1 = leather({ x: 0, y: 0.9, z: z - 21.2, w: 2.4, d: 2.0, h: 0.9, color: 0x1a2a4a });
    const s2 = leather({ x: 0, y: 1.8, z: z - 24.0, w: 2.4, d: 2.0, h: 0.9, color: 0x6a3a22 });
    for (const [p, y] of [[s1, 0.9], [s2, 1.8]]) show.pillars(p.body.x, y - 0.9, p.body.z, 2.4, 2.0, { color: 0x3a2a20, r: 0.22 });
    show.route(s1); show.route(s2);
    const rack = deck({ x: 0, y: 1.8, z: z - 28.0, w: 7, d: 3.6, h: 0.5 });
    show.pillars(0, 1.3, z - 28.0, 7, 3.6);
    show.route(rack);
    // the trolley with no brakes: it rolls you north (and back, if you dawdle)
    const rZ = z - 31.2;
    const runaway = trolley(w, 0, 1.8, rZ, 2.4, 2.0);
    w.rollaway(runaway, { dir: [0, -1], dist: 6.4, accel: 3.2, speed: 4.6, delay: 0.5, hold: 2.6, back: 1.6, onGo: () => game.say('hotel.l2.roll', { priority: 1 }) });
    rails(w, show, 0, 0.75, rZ - 3.2, 2.4, 9.6);
    const shelf = deck({ x: 0, y: 1.8, z: z - 40.6, w: 8, d: 4.4, h: 0.5 });
    show.pillars(0, 1.3, z - 40.6, 8, 4.4);
    show.route(runaway, { ride: () => runaway.body.z > rZ - 6.2 });
    show.route(shelf);
    suitcases(w, 3, 1.8, z - 41.6, { n: 3, seed: 11 });
    show.z = z - 44.6;

    // ===== 3 · The Small Print =======================================================================================
    show.stage(NAMES[2], { say: 'hotel.l2.print' });
    show.round({ q: ask(['keys', 'hotel']), timer: 15, say: 'hotel.l2.r.timer', header: 'QUESTION 4 OF 9 · 15 SECONDS' });
    const r5 = show.round({ q: ask(['none']), none: true, say: 'hotel.l2.r.none', header: 'QUESTION 5 OF 9',
      onEnter: () => adBreak(game, w, { sec: 5, say: 'hotel.l2.ad', sayAfter: 'hotel.l2.ad.after' }) });
    show.round({ q: ask(['keys', 'sense']), flip: true, say: 'hotel.l2.r.flip', sayWrong: 'hotel.l2.wrong.flip', header: 'Q6 · PICK A WRONG ANSWER' });

    // ===== 4 · Revolving Door ========================================================================================
    z = show.z;
    const land = deck({ x: 0, y: 0, z: z - 2.5, w: 9, d: 5, h: 0.6 });
    show.pillars(0, -0.6, z - 2.5, 9, 5);
    show.stage(NAMES[3], { at: { x: 0, y: 0, z: z - 2.5 }, say: 'hotel.l2.door' });
    show.route(land);
    const door = revolvingDoor(w, game, 0, z - 13.5, 4.0);
    const out = deck({ x: 0, y: 0, z: z - 24.6, w: 9, d: 4, h: 0.6 });
    show.pillars(0, -0.6, z - 24.6, 9, 4);
    twistZone(game, w, { x: 0, y: 1.2, z: z - 13.5, w: 12, h: 2.4, d: 12 }, 'swap', { sec: 6, say: 'hotel.l2.swap' });
    show.route(door.discs[0], {});   // (the bot picks whichever disc comes round: see botPlan)
    show.route(out);
    show.z = z - 26.6;
    const doorStage = show.stages.length - 1;

    // ===== 5 · Last Questions ========================================================================================
    show.stage(NAMES[4], { say: 'hotel.l2.last' });
    show.round({ q: ask(['two']), say: 'hotel.l2.r.two', header: 'QUESTION 7 OF 9' });
    show.round({ q: ask(['host', 'l1', 'hotel']), mind: true, say: 'hotel.l2.r.mind', header: 'QUESTION 8 OF 9' });
    // the front desk: the level says you are done
    z = show.z;
    const lobby = deck({ x: 0, y: 0, z: z - 6, w: 20, d: 12, h: 1.4, tex: 'carpet', color: 0xb0283a });
    show.pillars(0, -1.4, z - 6, 18, 12);
    const deskZ = z - 9.5;
    w.plat({ x: -4.5, y: 1.1, z: deskZ, w: 6, d: 1.4, h: 1.1, tex: 'wood', color: 0xffffff, roughness: 0.3, radius: 0.05 });
    w.plat({ x: -4.5, y: 1.18, z: deskZ, w: 6.4, d: 1.7, h: 0.08, tex: 'marble', color: 0xffffff, roughness: 0.1, radius: 0.03 });
    w.sign({ text: 'CHECK-IN', x: -4.5, y: 4.0, z: deskZ - 1.0, w: 6, h: 1.3, color: '#f1d28a', double: false, tw: 1024, size: 130 });
    for (const sx of [-1, 1]) w.box({ x: -4.5 + sx * 2.8, y: 5.6, z: deskZ - 1.05, w: 0.05, h: 2.6, d: 0.05, color: GOLD, metal: 1, rough: 0.3, shadow: false });
    w.box({ x: -4.5, y: 4.0, z: deskZ - 1.1, w: 6.3, h: 1.5, d: 0.08, color: 0x1a1018, rough: 0.5 });
    bell(w, -2.4, 1.22, deskZ);
    let fakeDone = false, bonusOn = false;
    const deskGoal = w.goal({ x: 0, y: 0, z: z - 6.5, color: GOLD, onReach: () => {
      if (!fakeComplete(game, w, { title: 'CHECKED IN!', sub: 'Room 404 · Enjoy your stay', say: 'hotel.l2.fakewin', then: openRegister })) game.completeLevel();
      fakeDone = true;
    } });
    show.z = z - 12;

    // ===== 6 · The Register (only once the desk has lied to you) =========================================================
    const steps = [[4.5, 1.0, z - 9.6], [4.5, 2.1, z - 12.6], [1.5, 3.2, z - 14.8]].map(([x, y, zz], i) => {
      const p = leather({ x, y, z: zz, w: 2.4, d: 2.0, h: 0.9, color: [0x1a2a4a, 0x6a3a22, 0x4a1a22][i] });
      p.setEnabled(false); return p;
    });
    const stepLegs = steps.map((p) => { const m = w.box({ x: p.body.x, y: (p.top - 0.9) / 2, z: p.body.z, w: 1.8, h: p.top - 0.9, d: 1.4, color: 0x3a2a20, rough: 0.6 }); m.visible = false; return m; });
    show.z = z - 16.2;
    const regStage = show.stage(NAMES[5], { say: 'hotel.l2.register.stage' });
    for (const p of steps) show.route(p);
    const ti = Math.floor(Math.random() * 3), trustAnswers = ['Absolutely', 'Of course', 'Yes'];
    const tq = { q: 'Last one. Sign here.\nDo you trust me?', answers: [0, 1, 2].map((i) => (i === ti ? { text: 'No', correct: true } : { text: trustAnswers[i], correct: false })) };
    const yesL = L[tq.answers.findIndex((a) => a.text === 'Yes')];
    const r9 = show.round({ q: tq, y: 4.2, claim: 'lie', lieLetter: yesL, say: 'hotel.l2.r.trust', sayLie: 'hotel.l2.wrong.trust', header: 'THE REGISTER · QUESTION 9 OF 9', carpet: 0xd8c7ff });
    z = show.z;
    const fin = deck({ x: 0, y: 4.2, z: z - 4, w: 12, d: 8, h: 0.8 });
    show.pillars(0, 3.4, z - 4, 12, 8);
    const register = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 2.2), plainMaterial(0xf4ecd8, { roughness: 0.6 }));
    register.position.set(-3.6, 5.3, z - 6); w.add(register);
    w.plat({ x: -3.6, y: 5.15, z: z - 6, w: 1.4, d: 1.0, h: 0.95, tex: 'wood', color: 0xffffff, roughness: 0.3, radius: 0.05 });
    w.sign({ text: 'GUEST REGISTER', x: -3.6, y: 5.45, z: z - 6, w: 2.8, h: 0.6, rotX: -Math.PI / 2, color: '#3a2a10', double: false, tw: 512, size: 60 });
    const finalGoal = w.goal({ x: 2, y: 4.2, z: z - 5, color: GOLD, onReach: () => { game.say('hotel.l2.done', { priority: 2 }); game.completeLevel(); } });
    finalGoal.group.visible = false; finalGoal.trig.enabled = false;
    w.goalObj = deskGoal;
    const hidden = [...steps, r9.isl, ...r9.pads.map((p) => p.plat), fin];
    for (const p of hidden) { p.off = true; p.setEnabled(false); }
    r9.pads.forEach((p) => { p.off = true; });
    r9.hidden = true; r9.gate.grp.visible = false; regStage.cp.group.visible = false;
    show.reveal();
    function openRegister() {
      bonusOn = true;
      for (const p of hidden) { p.off = false; p.setEnabled(true); w.burst(new THREE.Vector3(p.body.x, p.top + 0.3, p.body.z), GOLD, 10, 3); }
      r9.pads.forEach((p) => { p.off = false; });
      stepLegs.forEach((m) => { m.visible = true; });
      r9.hidden = false; r9.gate.grp.visible = true; regStage.cp.group.visible = true;
      show.reveal();
      deskGoal.group.visible = false; deskGoal.trig.enabled = false;
      finalGoal.group.visible = true; finalGoal.trig.enabled = true; w.goalObj = finalGoal;
      game.say('hotel.l2.register', { priority: 2 });
    }

    // ---- the host ------------------------------------------------------------------------------------------------
    show.onStage = (i) => {
      if (i === 1) survey(game, w, { title: 'HOW ARE WE DOING?', lines: ['You have answered three questions.', 'Rate your check-in so far: 1 – 5', 'There is no 0. We checked.'], thanks: 'Thank you! Your feedback has been filed under "B".', say: 'hotel.l2.survey' });
    };
    onLand(w, game, shuttle, 'hotel.l2.shuttle');
    onLand(w, game, pile, 'hotel.l2.fakecp');
    onLand(w, game, rack, 'hotel.l2.rack');
    let intro = false, t0 = 0, lastWrong = -9;
    show.onClear = () => {};
    const wrongAt = () => { lastWrong = w.t; };
    for (const st of show.rounds) { const o = st.spec.onWrong; st.spec.onWrong = (s, p) => { wrongAt(); o?.(s, p); }; }
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) {
        intro = true;
        g.say('hotel.l2.intro'); g.say('hotel.l2.intro2');
        g.say('hotel.l2.r.honest', { vars: { letter: r1.claim } });
        stageTitle(g, w, 1, NAMES.length, NAMES[0]);
      }
    };
    w.hooks.onDeath = ({ deaths }) => {
      if (w.t - lastWrong < 4) return true;                     // the "wrong!" line already said it
      const p = game.player, s = show.curStage();
      if (deaths === 3) { game.say('hotel.l2.die.count', { priority: 1, vars: { n: deaths } }); return true; }
      if (s === doorStage && p.z < land.body.z - 2) { game.say('hotel.l2.die.door', { priority: 1 }); return true; }
      if (s === 1) { game.say('hotel.l2.die.trolley', { priority: 1 }); return true; }
      return false;
    };

    // ---- the bot: the runner plays the rounds; the door needs a disc that is coming round -------------------------------
    w.botPlan = (g) => {
      const p = g.player;
      if (g.frozen || g.modal) return show.bot(g);
      if (show.curStage() === doorStage && show.live() && !show.live().reached) {
        if (p.grounded && p.ground === land.body) {
          const d = door.discs.find((q) => { const a = door.angleOf(q); return a > -0.55 && a < -0.1; });
          return d ? { body: d.body } : { wait: true, x: p.x, z: Math.min(p.z, land.body.z) };
        }
        const on = door.discs.find((q) => p.grounded && p.ground === q.body);
        if (on) { const a = door.angleOf(on); return Math.abs(Math.abs(a) - Math.PI) < 0.3 ? { body: out.body } : { wait: true, x: p.x, z: p.z }; }
      }
      if (!show.live() && !fakeDone) return { x: deskGoal.x, z: deskGoal.z };
      if (!show.live() && bonusOn) return { x: finalGoal.x, z: finalGoal.z };
      return show.bot(g);
    };
    w.checkin = { show, door, shuttle, runaway, deskGoal, finalGoal, steps, r9, get bonusOn() { return bonusOn; }, fakeCp, dock, land, out };
    void r5;
  },
};

// ---- pieces ------------------------------------------------------------------------------------------------------------
/** "Say this once when you first land on that platform." */
function onLand(w, game, plat, key) {
  let said = false;
  w.onUpdate(() => { if (!said && game.player.grounded && game.player.ground === plat.body) { said = true; game.say(key, { priority: 1 }); } });
}

/** A brass luggage trolley: a deck you stand on, four poles down to wheels that run on rails, a few suitcases. */
function trolley(w, x, y, z, wd, dp) {
  const deck = w.plat({ x, y, z, w: wd, d: dp, h: 0.12, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.03 });
  deck.o.moving = true; deck.group.matrixAutoUpdate = true;
  const gold = plainMaterial(GOLD, { metalness: 1, roughness: 0.28 }), rubber = plainMaterial(0x14141a, { roughness: 0.6 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 8), gold); pole.position.set(sx * (wd / 2 - 0.15), -0.06 - 0.42, sz * (dp / 2 - 0.2)); deck.group.add(pole);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), rubber); wheel.rotation.z = Math.PI / 2; wheel.position.set(sx * (wd / 2 - 0.15), -0.9 - 0.06, sz * (dp / 2 - 0.2)); deck.group.add(wheel);
  }
  // a hanging rail (the classic hotel trolley arch) — at the far side, out of your way
  for (const sx of [-1, 1]) { const up = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), gold); up.position.set(sx * (wd / 2 - 0.1), 0.86, -dp / 2 + 0.1); deck.group.add(up); }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, wd - 0.2, 8), gold); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.66, -dp / 2 + 0.1); deck.group.add(bar);
  return deck;
}
/** Two gold rails (with posts down to the pit) that a trolley rides on. */
function rails(w, show, x, y, zc, wd, len) {
  for (const sx of [-1, 1]) w.box({ x: x + sx * (wd / 2 - 0.15), y, z: zc, w: 0.12, h: 0.1, d: len, color: GOLD, metal: 1, rough: 0.3, shadow: false });
  for (let k = 0; k < 3; k++) { const zz = zc - len / 2 + 0.4 + k * (len - 0.8) / 2; for (const sx of [-1, 1]) w.box({ x: x + sx * (wd / 2 - 0.15), y: (y - 0.05 + -9) / 2, z: zz, w: 0.14, h: y - 0.05 + 9, d: 0.14, color: 0x3a3440, rough: 0.5, shadow: false }); }
  void show;
}
function bell(w, x, y, z) {
  const g = plainMaterial(GOLD, { metalness: 1, roughness: 0.15 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.05, 16), g); base.position.set(x, y + 0.02, z); w.add(base);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), g); dome.position.set(x, y + 0.04, z); w.add(dome);
}

/**
 * The revolving door, as a ride: four round floor plates on arms round a brass axis (the plates move, they do not turn,
 * so you keep facing the way you face). Step on as one comes past, ride half a turn, step off on the far side.
 */
function revolvingDoor(w, game, cx, cz, R) {
  const omega = 0.6, n = 4, discs = [];
  const angle = (k, t) => -omega * t + (k * Math.PI * 2) / n;          // 0 = due south (+z); it turns clockwise seen from above
  const gold = plainMaterial(GOLD, { metalness: 1, roughness: 0.28 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false });
  // the axis (solid), the canopy and the sign
  w.collider({ x: cx, y: 1.5, z: cz, w: 0.9, h: 23, d: 0.9 });
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 22.6, 20), gold); axis.position.set(cx, 1.6, cz); w.add(axis);
  const canopy = new THREE.Mesh(new THREE.TorusGeometry(R + 1.6, 0.18, 10, 64), gold); canopy.rotation.x = Math.PI / 2; canopy.position.set(cx, 5.2, cz); w.add(canopy);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.6, R + 1.6, 0.12, 48, 1, true), glass); roof.position.set(cx, 5.2, cz); w.add(roof);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, R + 1.6, 6), gold); sp.rotation.z = Math.PI / 2; sp.rotation.y = -a; sp.position.set(cx + Math.cos(a) * (R + 1.6) / 2, 5.2, cz + Math.sin(a) * (R + 1.6) / 2); w.add(sp); }
  w.sign({ text: 'REVOLVING DOOR · KEEP MOVING', x: cx, y: 6.0, z: cz + R + 1.7, w: 7, h: 0.8, color: '#f1d28a', double: true, tw: 1024, size: 70, glow: true });
  // the arms turn with the plates
  const spin = new THREE.Group(); spin.position.set(cx, 0, cz); w.add(spin);
  for (let k = 0; k < n; k++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, R - 0.4), gold); arm.position.set(0, -0.25, (R - 0.4) / 2 + 0.3);
    const holder = new THREE.Group(); holder.rotation.y = (k * Math.PI * 2) / n; holder.add(arm); spin.add(holder);
  }
  for (let k = 0; k < n; k++) {
    const p = w.plat({ x: cx, y: 0, z: cz + R, w: 2.6, d: 2.6, h: 0.3, tex: 'marble', color: 0xffffff, radius: 0.05 });
    p.group.children.forEach((m) => { m.visible = false; });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.3, 32), plainMaterial(0xd8d0e8, { roughness: 0.2 })); p.group.add(top);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.05, 8, 40), glowMaterial(GOLD, 1.4)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.15; p.group.add(rim);
    w.mover(p, (t) => { const a = angle(k, t); return { x: Math.sin(a) * R, z: Math.cos(a) * R - R }; });
    discs.push(p);
  }
  w.onUpdate((dt, t) => { spin.rotation.y = -omega * t; });
  const angleOf = (p) => { let a = Math.atan2(p.body.x - cx, p.body.z - cz); return a; };   // 0 = south, ±π = north
  return { discs, angleOf, omega };
}
