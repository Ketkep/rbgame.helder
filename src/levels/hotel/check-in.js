import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, chandelier, GOLD } from './kit.js';
import { pickQuestion } from './quiz.js';
import { quizShow, suitcases } from './quiz-show.js';
import { survey, adBreak, fakeComplete, trollCheckpoint, twistZone, stageTitle } from './trolls.js';

// Hotel level 2 — "Check-In" (Easy · Mezzanine). A registration desk that will not stop asking. Ten questions in four acts,
// one twist per question, two interludes, and a front desk that says you are done when you are not.
//   1 Registration      Q1 honest · Q2 the host lies (too confident) · Q3 the pads slide          → a survey: "How are we doing?"
//   2 Luggage Trolleys  a trolley shuttle, a FAKE checkpoint (crooked pole), suitcase stairs, a trolley that rolls off with you
//   3 The Small Print   Q4 a 16 s clock across stepping stones · Q5 an ad over the board, and "None of the above" ·
//                       Q6 PICK A WRONG ANSWER
//   4 Revolving Doors   ride two revolving doors round (the first one swaps A and D on the way)
//   5 Last Questions    Q7 two right answers (the host says one is a trap) · Q8 breathing pads ·
//                       Q9 the host changes his mind after you sign      → the desk: CHECKED IN! (…just kidding)
//   6 The Register      suitcase towers and a baggage belt up to the guest register · Q10 "Do you trust me?" · the real goal
// Baby Mode: the clock is slower, wrong pads wobble long enough to hop off, the fake checkpoint counts, the swap is short,
// the host does not change his mind.

const NAMES = ['Registration', 'Luggage Trolleys', 'The Small Print', 'Revolving Doors', 'Last Questions', 'The Register'];
const L = ['A', 'B', 'C', 'D'];
const NQ = 10;

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
    const zFar = -290;
    const hall = roomShell(w, { x0: -13, x1: 13, z0: zFar, z1: Z0 + 4, yb: -10, wallTex: 'damask', wallColor: 0xffffff, pilasterEvery: 14, beamEvery: 12 });
    w.plat({ x: 0, y: -9.5, z: hall.cz, w: 26, d: hall.D, h: 1, tex: 'carpet', color: 0x3a0e18, roughness: 0.95 });
    for (const z of [Z0 - 6, -50, -110, -175, -240]) chandelier(w, 0, 9.6, z, 0.8);

    const show = quizShow(w, game, { prefix: 'hotel.l2', names: NAMES, z0: Z0, hallW: 22, carpet: 0xf3e6d0 });
    const used = new Set();
    const ask = (pools, n = 3) => pickQuestion(game, pools, { used, n });
    const deck = (o) => w.plat({ tex: 'marble', color: 0xece3cf, roughness: 0.2, radius: 0.05, ...o });
    const leather = (o) => w.plat({ tex: 'leather', roughness: 0.5, radius: 0.08, ...o });
    const H = (n, extra = '') => `QUESTION ${n} OF ${NQ}${extra}`;

    // ===== 1 · Registration ===========================================================================================
    show.stage(NAMES[0], { flag: false });
    const r1 = show.round({ q: ask(['keys']), claim: 'right', header: H(1) });
    show.round({ q: ask(['hotel', 'host']), claim: 'lie', say: 'hotel.l2.r.lie', header: H(2) });
    show.round({ q: ask(['sense']), slide: 1.3, say: 'hotel.l2.r.slide', header: H(3) });

    // ===== 2 · Luggage Trolleys ======================================================================================
    let z = show.z;                               // the gap after question 3's gate starts here
    const dock = deck({ x: 0, y: 0, z: z - 2.5, w: 9, d: 5, h: 0.6 });
    show.pillars(0, -0.6, z - 2.5, 9, 5);
    show.stage(NAMES[1], { at: { x: 0, y: 0, z: z - 2.5 }, say: 'hotel.l2.trolleys', width: 9 });
    show.route(dock);
    suitcases(w, -3.4, 0, z - 3.6, { n: 3, seed: 2 }); suitcases(w, 3.5, 0, z - 1.4, { n: 2, seed: 5 });
    w.sign({ text: 'LUGGAGE ▸ THIS WAY', x: 0, y: 0.02, z: z - 1.2, w: 4.4, h: 0.8, rotX: -Math.PI / 2, color: '#f1d28a', double: false, tw: 1024, size: 80 });
    // a shuttle trolley on rails: rides you from the dock to the suitcases
    const shZ = z - 10.2;
    const shuttle = trolley(w, 0, 0, shZ, 2.6, 2.4);
    w.mover(shuttle, (t) => ({ z: 2.7 * Math.sin(t * 0.75) }));
    rails(w, 0, -0.9, shZ, 2.6, 9);
    const pile = leather({ x: 0, y: 0, z: z - 17.4, w: 6, d: 3.4, h: 0.5, color: 0x5a2a1a });
    show.pillars(0, -0.5, z - 17.4, 6, 3.4, { color: 0x3a2a20 });
    suitcases(w, -2.2, 0, z - 18.2, { n: 4, seed: 3 }); suitcases(w, 2.3, 0, z - 18.4, { n: 2, seed: 9 });
    show.route(shuttle, { wait: () => shuttle.body.z < shZ + 2.0, ride: (g) => shuttle.body.z > shZ - 2.2 && g.player.z > shZ - 3 });
    show.route(pile);
    const fakeCp = trollCheckpoint(w, game, { x: 0, y: 0, z: z - 17.2, mode: 'fake' });             // the pole is a hair crooked
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
    w.rollaway(runaway, { dir: [0, -1], dist: 6.0, accel: 3.2, speed: 4.6, delay: 0.5, hold: 2.6, back: 1.6, onGo: () => game.say('hotel.l2.roll', { priority: 1 }) });
    rails(w, 0, 0.9, rZ - 3.0, 2.4, 9.2);
    const shelf = deck({ x: 0, y: 1.8, z: z - 40.6, w: 8, d: 4.4, h: 0.5 });
    show.pillars(0, 1.3, z - 40.6, 8, 4.4);
    show.route(runaway, { ride: () => runaway.body.z > rZ - 5.8 });
    show.route(shelf, { save: { x: 0, y: 1.8, z: z - 40.6 } });
    suitcases(w, 3, 1.8, z - 41.6, { n: 3, seed: 11 });
    // two trolleys passing each other sideways: hop across on the one coming your way
    const cZ1 = z - 46.0, cZ2 = z - 50.6;
    const cartA = trolley(w, 0, 1.8, cZ1, 2.4, 2.2), cartB = trolley(w, 0, 1.8, cZ2, 2.4, 2.2);
    w.mover(cartA, (t) => ({ x: 3.2 * Math.sin(t * 0.7) }));
    w.mover(cartB, (t) => ({ x: -3.2 * Math.sin(t * 0.7) }));
    railsX(w, 0, 0.9, cZ1, 2.2, 10); railsX(w, 0, 0.9, cZ2, 2.2, 10);
    const ramp = deck({ x: 0, y: 1.8, z: z - 55.8, w: 8, d: 4, h: 0.5 });
    show.pillars(0, 1.3, z - 55.8, 8, 4);
    const nearMid = (c) => () => Math.abs(c.body.x) > 1.3;
    show.route(cartA, { wait: nearMid(cartA), ride: () => Math.abs(cartB.body.x - cartA.body.x) > 1.0 });
    show.route(cartB, { ride: () => Math.abs(cartB.body.x) > 1.1 });
    show.route(ramp, { save: { x: 0, y: 1.8, z: z - 55.8 } });
    show.z = z - 59.6;

    // ===== 3 · The Small Print =======================================================================================
    show.stage(NAMES[2]);
    show.round({ q: ask(['keys', 'hotel']), timer: 16, stones: 2, say: 'hotel.l2.r.timer', header: H(4, ' · 16 SECONDS') });
    show.round({ q: ask(['none']), none: true, say: 'hotel.l2.ad', header: H(5),
      onEnter: () => adBreak(game, w, { sec: 5, sayAfter: 'hotel.l2.r.none' }) });
    show.round({ q: ask(['keys', 'sense']), flip: true, say: 'hotel.l2.r.flip', sayWrong: 'hotel.l2.wrong.flip', header: `Q${6} · PICK A WRONG ANSWER` });

    // ===== 4 · Revolving Doors =======================================================================================
    z = show.z;
    const land = deck({ x: 0, y: 0, z: z - 3.6, w: 9, d: 7.2, h: 0.6 });
    show.pillars(0, -0.6, z - 3.6, 9, 7.2);
    show.stage(NAMES[3], { at: { x: 0, y: 0, z: z - 3.0 }, say: 'hotel.l2.door', width: 9 });
    show.route(land);
    const door1 = revolvingDoor(w, 0, z - 13.5, 4.0, { dir: -1, omega: 0.6, sign: 'REVOLVING DOOR · KEEP MOVING' });
    const mid = deck({ x: 0, y: 0, z: z - 21.8, w: 9, d: 4, h: 0.6 });
    show.pillars(0, -0.6, z - 21.8, 9, 4);
    twistZone(game, w, { x: 0, y: 1.2, z: z - 13.5, w: 12, h: 2.4, d: 11.4 }, 'swap', { sec: 6, say: 'hotel.l2.swap' });
    show.route(door1.discs[0], { alt: door1.discs.map((d) => d.body) });   // (the bot picks whichever disc comes round: see botPlan)
    show.route(mid, { save: { x: 0, y: 0, z: z - 21.8 } });
    const door2 = revolvingDoor(w, 0, z - 30.1, 4.0, { dir: 1, omega: 0.72, sign: 'EXIT · THIS WAY ROUND' });
    const out = deck({ x: 0, y: 0, z: z - 38.4, w: 9, d: 4, h: 0.6 });
    show.pillars(0, -0.6, z - 38.4, 9, 4);
    show.route(door2.discs[0], { alt: door2.discs.map((d) => d.body) });
    show.route(out, { save: { x: 0, y: 0, z: z - 38.4 } });
    show.z = z - 41.9;
    const doorStage = show.stages.length - 1;
    const doors = [{ door: door1, from: land, to: mid }, { door: door2, from: mid, to: out }];

    // ===== 5 · Last Questions ========================================================================================
    show.stage(NAMES[4], { say: 'hotel.l2.last' });
    show.round({ q: ask(['two']), say: 'hotel.l2.r.two', header: H(7) });
    show.round({ q: ask(['sense', 'hotel']), breathe: true, say: 'hotel.l2.r.breathe', header: H(8) });
    show.round({ q: ask(['host', 'l1', 'hotel']), mind: true, say: 'hotel.l2.r.mind', header: H(9) });
    // the front desk: the level says you are done
    z = show.z;
    const lobby = deck({ x: 0, y: 0, z: z - 6, w: 20, d: 12, h: 1.4, tex: 'carpet', color: 0xb0283a });
    show.pillars(0, -1.4, z - 6, 18, 12);
    show.route(lobby, { save: { x: 0, y: 0, z: z - 2.5 } });
    const deskZ = z - 9.5;
    w.plat({ x: -4.5, y: 1.1, z: deskZ, w: 6, d: 1.4, h: 1.1, tex: 'wood', color: 0xffffff, roughness: 0.3, radius: 0.05 });
    w.plat({ x: -4.5, y: 1.18, z: deskZ, w: 6.4, d: 1.7, h: 0.08, tex: 'marble', color: 0xffffff, roughness: 0.1, radius: 0.03 });
    w.box({ x: -4.5, y: 4.0, z: deskZ - 1.15, w: 6.3, h: 1.5, d: 0.08, color: 0x1a1018, rough: 0.5 });
    w.sign({ text: 'CHECK-IN', x: -4.5, y: 4.0, z: deskZ - 1.09, w: 6, h: 1.3, color: '#f1d28a', double: false, tw: 1024, size: 130 });
    for (const sx of [-1, 1]) w.box({ x: -4.5 + sx * 2.8, y: (4.75 + 13) / 2, z: deskZ - 1.15, w: 0.05, h: 13 - 4.75, d: 0.05, color: GOLD, metal: 1, rough: 0.3, shadow: false });
    bell(w, -2.4, 1.22, deskZ);
    suitcases(w, -8, 0, z - 3, { n: 3, seed: 21 });
    let bonusOn = false;
    const deskGoal = w.goal({ x: 0, y: 0, z: z - 6.5, color: GOLD, onReach: () => {
      if (!fakeComplete(game, w, { title: 'CHECKED IN!', sub: 'Room 404 · Enjoy your stay', say: 'hotel.l2.fakewin', then: openRegister })) game.completeLevel();
    } });

    // ===== 6 · The Register (only there once the desk has lied to you) ===================================================
    // three suitcase towers up from the lobby floor, then a baggage belt that runs the wrong way, then the register
    const nPlats0 = w.plats.length;
    const towers = [[5, 1.1, z - 5.0], [5, 2.2, z - 8.0], [5, 3.3, z - 11.0]].map(([x, y, zz], i) => leather({ x, y, z: zz, w: 2.2, d: 2.0, h: y, color: [0x1a2a4a, 0x6a3a22, 0x4a1a22][i] }));
    const hiddenMeshes = towers.map((p) => w.box({ x: p.body.x, y: p.top - 0.3, z: p.body.z, w: 0.12, h: 0.06, d: 2.04, color: GOLD, metal: 1, rough: 0.3, shadow: false }));
    const belt = w.conveyor(w.plat({ x: 5, y: 3.3, z: z - 16.6, w: 2.6, d: 9.2, h: 0.4, tex: 'metal', color: 0x3a3440, roughness: 0.5 }), { vz: 2.2 });
    hiddenMeshes.push(...show.pillars(5, 2.9, z - 16.6, 2.6, 9.2, { r: 0.22 }));
    show.z = z - 22.6;
    const regStage = show.stage(NAMES[5], { say: 'hotel.l2.register.stage' });
    for (const p of towers) show.route(p);
    show.route(belt);
    const ti = Math.floor(Math.random() * 3), trustAnswers = ['Absolutely', 'Of course', 'Yes'];
    const tq = { q: 'Last one. Sign here.\nDo you trust me?', answers: [0, 1, 2].map((i) => (i === ti ? { text: 'No', correct: true } : { text: trustAnswers[i], correct: false })) };
    const yesL = L[tq.answers.findIndex((a) => a.text === 'Yes')];
    const rLast = show.round({ q: tq, y: 3.3, claim: 'lie', lieLetter: yesL, say: 'hotel.l2.r.trust', sayLie: 'hotel.l2.wrong.trust', header: `THE REGISTER · ${H(10)}`, carpet: 0xd8c7ff, palms: false });
    z = show.z;
    const nPlats1 = w.plats.length;
    const fin = deck({ x: 0, y: 3.3, z: z - 4, w: 12, d: 8, h: 0.8 });
    hiddenMeshes.push(...show.pillars(0, 2.5, z - 4, 12, 8));
    show.route(fin);
    w.plat({ x: -3.6, y: 4.25, z: z - 6, w: 1.4, d: 1.0, h: 0.95, tex: 'wood', color: 0xffffff, roughness: 0.3, radius: 0.05 });
    hiddenMeshes.push(w.box({ x: -3.6, y: 4.37, z: z - 6, w: 2.6, h: 0.24, d: 1.8, color: 0xf4ecd8, rough: 0.6 }));
    hiddenMeshes.push(w.sign({ text: 'GUEST REGISTER', x: -3.6, y: 4.50, z: z - 6, w: 2.4, h: 0.5, rotX: -Math.PI / 2, color: '#3a2a10', double: false, tw: 512, size: 60 }));
    const finalGoal = w.goal({ x: 2, y: 3.3, z: z - 5, color: GOLD, onReach: () => { game.say('hotel.l2.done', { priority: 2 }); game.completeLevel(); } });
    finalGoal.group.visible = false; finalGoal.trig.enabled = false;
    w.goalObj = deskGoal;
    const hiddenPlats = [...w.plats.slice(nPlats0, nPlats0 + 4), ...w.plats.slice(nPlats1)];   // towers + belt, fin + lectern
    const setBonus = (on) => {
      for (const p of hiddenPlats) p.setEnabled(on);
      for (const m of hiddenMeshes) m.visible = on;
      show.setHidden(rLast, !on);
    };
    setBonus(false);
    function openRegister() {
      bonusOn = true;
      setBonus(true);
      for (const p of towers) w.burst(new THREE.Vector3(p.body.x, p.top + 0.3, p.body.z), GOLD, 10, 3);
      deskGoal.group.visible = false; deskGoal.trig.enabled = false;
      finalGoal.group.visible = true; finalGoal.trig.enabled = true; w.goalObj = finalGoal;
      game.say('hotel.l2.register', { priority: 2 });
    }
    void regStage;

    // ---- the host ------------------------------------------------------------------------------------------------
    show.onStage = (i) => {
      if (i === 1) survey(game, w, { title: 'HOW ARE WE DOING?', lines: ['You have answered three questions.', 'Rate your check-in so far: 1 – 5', 'There is no 0. We checked.'], thanks: 'Thank you! Your feedback has been filed under "B".', say: 'hotel.l2.survey' });
    };
    onLand(w, game, shuttle, 'hotel.l2.shuttle');
    onLand(w, game, pile, 'hotel.l2.fakecp');
    onLand(w, game, rack, 'hotel.l2.rack');
    onLand(w, game, shelf, 'hotel.l2.carts');
    onLand(w, game, mid, 'hotel.l2.door2');
    onLand(w, game, lobby, 'hotel.l2.desk');
    onLand(w, game, belt, 'hotel.l2.belt');
    let intro = false, t0 = 0, lastWrong = -9;
    for (const st of show.rounds) { const o = st.spec.onWrong; st.spec.onWrong = (s, p) => { lastWrong = w.t; o?.(s, p); }; }
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
      if (w.t - lastWrong < 4) return true;                                    // the "wrong!" line already said it
      if (game.lastFakeCp && !game.fakeRevealed && !game.baby) return false;   // let the host gloat about the crooked pole
      const p = game.player, s = show.curStage();
      if (deaths === 3) { game.say('hotel.l2.die.count', { priority: 1, vars: { n: deaths } }); return true; }
      if (s === doorStage && p.z < land.body.z - 3) { game.say('hotel.l2.die.door', { priority: 1 }); return true; }
      if (s === 1) { game.say('hotel.l2.die.trolley', { priority: 1 }); return true; }
      return false;
    };
    // the hint: honest, and only ever as far as the next thing
    const baseHint = w.hintFn;
    const pt = (o, dy = 0.15) => ({ x: o.x, y: o.y + dy, z: o.z });
    const top = (p) => ({ x: p.body.x, y: p.top + 0.15, z: p.body.z });
    w.hintFn = (g) => {
      const p = g.player;
      if (show.cleared >= NQ - 1 && !bonusOn) return [pt(p), pt(deskGoal)];
      if (bonusOn && !rLast.reached) return [pt(p), ...towers.map(top), { x: 5, y: 3.45, z: belt.body.z - 4 }, { x: 0, y: 3.45, z: rLast.zc }];
      if (bonusOn && show.cleared >= NQ) return [pt(p), pt(finalGoal)];
      return baseHint(g);
    };

    // ---- the bot: the runner plays the rounds; a revolving door needs a disc that is coming round -----------------------
    let pick = null;
    w.botPlan = (g) => {
      const p = g.player, base = show.bot(g);      // (always ask the runner first: it keeps track of where you are)
      if (g.frozen || g.modal) return base;
      for (const d of doors) {
        if (p.grounded && p.ground === d.from.body && show.cleared === 6) {
          pick = d.door.discs.find((q) => d.door.approaching(q)) || null;
          return pick ? { body: pick.body } : { wait: true, x: p.x, z: p.z };
        }
        const on = d.door.discs.find((q) => p.grounded && p.ground === q.body);
        if (on) { pick = null; return Math.abs(d.door.angleOf(on)) > Math.PI - 0.3 ? { body: d.to.body } : { wait: true, x: p.x, z: p.z }; }
      }
      if (!p.grounded && pick && show.cleared === 6) return { body: pick.body };
      if (p.grounded) pick = null;
      if (show.cleared >= NQ - 1 && !bonusOn) return { x: deskGoal.x, z: deskGoal.z };
      if (bonusOn && show.cleared >= NQ) return { x: finalGoal.x, z: finalGoal.z };
      return base;
    };
    w.checkin = { show, doors, shuttle, runaway, cartA, cartB, deskGoal, finalGoal, towers, belt, rLast, fakeCp, dock, land, mid, out, lobby, get bonusOn() { return bonusOn; } };
  },
};

// ---- pieces ------------------------------------------------------------------------------------------------------------
/** "Say this once when you first land on that platform." */
function onLand(w, game, plat, key) {
  let said = false;
  w.onUpdate(() => { if (!said && game.state === 'playing' && game.player.grounded && game.player.ground === plat.body) { said = true; game.say(key, { priority: 1 }); } });
}

/** A brass luggage trolley: a deck you stand on, four poles down to wheels that run on rails, the classic hanging arch. */
function trolley(w, x, y, z, wd, dp) {
  const deck = w.plat({ x, y, z, w: wd, d: dp, h: 0.12, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.03 });
  deck.o.moving = true; deck.group.matrixAutoUpdate = true;
  const gold = plainMaterial(GOLD, { metalness: 1, roughness: 0.28 }), rubber = plainMaterial(0x14141a, { roughness: 0.6 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 8), gold); pole.position.set(sx * (wd / 2 - 0.15), -0.06 - 0.31, sz * (dp / 2 - 0.2)); deck.group.add(pole);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), rubber); wheel.rotation.z = Math.PI / 2; wheel.position.set(sx * (wd / 2 - 0.15), -0.72, sz * (dp / 2 - 0.2)); deck.group.add(wheel);
  }
  for (const sx of [-1, 1]) { const up = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), gold); up.position.set(sx * (wd / 2 - 0.1), 0.86, -dp / 2 + 0.1); deck.group.add(up); }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, wd - 0.2, 8), gold); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.66, -dp / 2 + 0.1); deck.group.add(bar);
  return deck;
}
/** Two gold rails along z (on posts down to the pit floor) that a trolley's wheels run on; `y` is the rail top (deck top − 0.9). */
function rails(w, x, y, zc, wd, len) {
  for (const sx of [-1, 1]) w.box({ x: x + sx * (wd / 2 - 0.15), y: y - 0.05, z: zc, w: 0.12, h: 0.1, d: len, color: GOLD, metal: 1, rough: 0.3, shadow: false });
  for (let k = 0; k < 3; k++) {
    const zz = zc - len / 2 + 0.4 + k * (len - 0.8) / 2;
    for (const sx of [-1, 1]) w.box({ x: x + sx * (wd / 2 - 0.15), y: (y - 0.1 - 9) / 2, z: zz, w: 0.14, h: y - 0.1 + 9, d: 0.14, color: 0x3a3440, rough: 0.5, shadow: false });
  }
}
/** The same, along x (for trolleys that run sideways); `dp` is the trolley's depth. */
function railsX(w, xc, y, z, dp, len) {
  for (const sz of [-1, 1]) w.box({ x: xc, y: y - 0.05, z: z + sz * (dp / 2 - 0.2), w: len, h: 0.1, d: 0.12, color: GOLD, metal: 1, rough: 0.3, shadow: false });
  for (let k = 0; k < 3; k++) {
    const xx = xc - len / 2 + 0.4 + k * (len - 0.8) / 2;
    for (const sz of [-1, 1]) w.box({ x: xx, y: (y - 0.1 - 9) / 2, z: z + sz * (dp / 2 - 0.2), w: 0.14, h: y - 0.1 + 9, d: 0.14, color: 0x3a3440, rough: 0.5, shadow: false });
  }
}
function bell(w, x, y, z) {
  const g = plainMaterial(GOLD, { metalness: 1, roughness: 0.15 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.05, 16), g); base.position.set(x, y + 0.02, z); w.add(base);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), g); dome.position.set(x, y + 0.04, z); w.add(dome);
}

/**
 * A revolving door, as a ride: four round floor plates on arms round a brass axis (the plates move, they do not turn,
 * so you keep facing the way you face). Step on as one comes past, ride half a turn, step off on the far side.
 * `dir` -1 turns clockwise seen from above, +1 the other way.
 */
function revolvingDoor(w, cx, cz, R, { dir = -1, omega = 0.6, sign = 'REVOLVING DOOR' } = {}) {
  const n = 4, discs = [];
  const angle = (k, t) => dir * omega * t + (k * Math.PI * 2) / n;          // 0 = due south (+z)
  const gold = plainMaterial(GOLD, { metalness: 1, roughness: 0.28 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  // the axis (solid), the canopy and the sign
  w.collider({ x: cx, y: 1.5, z: cz, w: 0.9, h: 23, d: 0.9 });
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 22.6, 20), gold); axis.position.set(cx, 1.6, cz); w.add(axis);
  const canopy = new THREE.Mesh(new THREE.TorusGeometry(R + 1.6, 0.18, 10, 64), gold); canopy.rotation.x = Math.PI / 2; canopy.position.set(cx, 5.2, cz); w.add(canopy);
  const roof = new THREE.Mesh(new THREE.CircleGeometry(R + 1.6, 48), glass); roof.rotation.x = -Math.PI / 2; roof.position.set(cx, 5.25, cz); w.add(roof);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, R + 1.6, 6), gold); sp.rotation.z = Math.PI / 2; sp.rotation.y = -a; sp.position.set(cx + Math.cos(a) * (R + 1.6) / 2, 5.2, cz + Math.sin(a) * (R + 1.6) / 2); w.add(sp); }
  w.sign({ text: sign, x: cx, y: 6.0, z: cz + R + 1.7, w: 7, h: 0.8, color: '#f1d28a', double: true, tw: 1024, size: 70, glow: true });
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
  w.onUpdate((dt, t) => { spin.rotation.y = dir * omega * t; });
  const angleOf = (p) => Math.atan2(p.body.x - cx, p.body.z - cz);   // 0 = south, ±π = north
  // a plate about to pass the south side (where you get on)
  const approaching = (p) => { const a = angleOf(p); return dir < 0 ? a > 0.12 && a < 0.5 : a < -0.12 && a > -0.5; };
  return { discs, angleOf, approaching, omega, dir };
}
