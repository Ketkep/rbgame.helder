import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, chandelier, hotelHalo, GOLD } from './kit.js';
import { pickQuestion } from './quiz.js';
import { quizShow } from './quiz-show.js';
import { survey, crash, fakeComplete, trollCheckpoint, twistZone, vanishAfter, stageTitle } from './trolls.js';

// Hotel level 7 — "Trivia Night" (Medium · Ballroom). A game show in the grand ballroom: ten rounds, a twist for every one,
// two intermissions of platforming, and a trophy that is not the end.
//   1 Warm-Up Round     R1 honest · R2 the host lies · R3 the pads slide                         → a survey ("under B")
//   2 Chandelier Hop    swaying chandeliers, one that gives way under you (it shimmers), a swinging one
//   3 Speed & Sound     R4 a 12 s clock · R5 four answers and reverse psychology · R6 "which did I swear in round 2?"
//   4 The Balcony       a belt the wrong way, crumbling tiles (mirror mode), a rolling cable, an EXPIRING checkpoint
//   5 The Final Three   (the broadcast crashes) R7 no answer is right · R8 double or nothing · R9 the question changes when you sign
//   6 The Tie-Breaker   the trophy is a lie (CHAMPION! …a tie-breaker): a chandelier bridge and R10, where the audience poll lies
// Baby Mode: the clock is slower, wrong pads wobble long enough to hop off, the question never changes, twists are short,
// the expiring checkpoint keeps, vanishing chandeliers wait longer.

const NAMES = ['Warm-Up Round', 'Chandelier Hop', 'Speed & Sound', 'The Balcony', 'The Final Three', 'The Tie-Breaker'];
const L = ['A', 'B', 'C', 'D'];
const NQ = 10;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export default {
  id: 'hotel-7',
  name: 'Trivia Night',
  music: 'hotel_ballroom',
  completeQuip: 'Ten rounds. The audience is on its feet. Mostly because the chairs are bolted to a different floor.',

  build(w, game) {
    hotelEnv(w);
    const Z0 = 12;
    w.spawn = { x: 0, y: 0, z: Z0 - 1.8, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -6;
    const zFar = -318;
    const hall = roomShell(w, { x0: -17, x1: 17, z0: zFar, z1: Z0 + 4, yb: -10, wallTex: 'damask', wallColor: 0x8da4e8, pilasterEvery: 12, beamEvery: 12 });
    w.plat({ x: 0, y: -9.5, z: hall.cz, w: 34, d: hall.D, h: 1, tex: 'carpet', color: 0x1f2a58, roughness: 0.95 });
    // the audience, far below: round tables with candles and nobody in the seats
    const tableTop = new THREE.CylinderGeometry(1.4, 1.4, 0.1, 18), stemG = new THREE.CylinderGeometry(0.12, 0.12, 2.0, 8), clothG = new THREE.CylinderGeometry(1.5, 1.7, 0.6, 18);
    const flameG = new THREE.SphereGeometry(0.07, 8, 6), chairG = new THREE.BoxGeometry(0.6, 0.9, 0.6);
    const linen = plainMaterial(0xf4ecd8, { roughness: 0.6 }), goldM = plainMaterial(GOLD, { metalness: 1, roughness: 0.3 }), flameM = glowMaterial(0xffc060, 2.2), chairM = plainMaterial(0x7a1f2a, { roughness: 0.6 });
    for (let z = Z0 + 2; z > zFar + 6; z -= 11) for (const sx of [-1, 1]) {
      const x = sx * 13.2, yb = -7.6;
      const top = new THREE.Mesh(tableTop, linen); top.position.set(x, yb + 1.4, z); w.add(top);
      const stem = new THREE.Mesh(stemG, goldM); stem.position.set(x, yb + 0.4, z); w.add(stem);
      const cloth = new THREE.Mesh(clothG, linen); cloth.position.set(x, yb + 1.15, z); w.add(cloth);
      const flame = new THREE.Mesh(flameG, flameM); flame.position.set(x, yb + 1.65, z); w.add(flame);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; const ch = new THREE.Mesh(chairG, chairM); ch.position.set(x + Math.cos(a) * 2.3, yb + 0.1, z + Math.sin(a) * 2.3); w.add(ch); }
    }
    for (const z of [Z0 - 6, -60, -120, -190, -250, -300]) chandelier(w, 0, 9.6, z, 0.85);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 2), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.08, flatShading: true, emissive: 0x222233 }));
    ball.position.set(0, 9.8, Z0 - 90); w.add(ball);
    w.onUpdate((dt) => { ball.rotation.y += dt * 0.8; });
    void hotelHalo;

    const show = quizShow(w, game, { prefix: 'hotel.l7', names: NAMES, z0: Z0, hallW: 22, carpet: 0xc6d2ff });
    const used = new Set();
    const ask = (pools, n = 3) => pickQuestion(game, pools, { used, n });
    const deck = (o) => w.plat({ tex: 'marble', color: 0xece3cf, roughness: 0.2, radius: 0.05, ...o });
    const H = (n, extra = '') => `ROUND ${n} OF ${NQ}${extra}`;
    const bonusPlats = [], bonusMeshes = [];

    // ===== 1 · Warm-Up Round =========================================================================================
    show.stage(NAMES[0], { flag: false });
    const r1 = show.round({ q: ask(['keys']), claim: 'right', say: 'hotel.l7.r.honest', header: H(1) });
    const r2 = show.round({ q: ask(['f1', 'hotel']), claim: 'lie', say: 'hotel.l7.r.lie', header: H(2) });
    show.round({ q: ask(['f1', 'dyn2', 'hotel']), slide: 1.3, say: 'hotel.l7.r.slide', header: H(3) });
    void r1;

    // ===== 2 · Chandelier Hop ========================================================================================
    let z = show.z;
    const zA = z;
    const dockA = deck({ x: 0, y: 0, z: z - 2.5, w: 9, d: 5, h: 0.6 });
    show.pillars(0, -0.6, z - 2.5, 9, 5);
    show.stage(NAMES[1], { at: { x: 0, y: 0, z: z - 2.5 }, say: 'hotel.l7.hop', width: 9 });
    show.route(dockA);
    const c1 = chandPlat(w, game, -2.5, 0.7, z - 7.0);
    const c2 = chandPlat(w, game, 0, 1.4, z - 10.8);
    w.mover(c2, (t) => ({ x: 1.7 * Math.sin(t * 0.95) }));
    const c3 = chandPlat(w, game, 3.0, 2.1, z - 14.8);
    const lift = chandPlat(w, game, 0.5, 2.1, z - 19.0, 2.8);                        // a chandelier on a winch: wait for it, ride it up
    w.mover(lift, (t) => ({ y: 1.2 * (1 - Math.cos(t * 0.7)) }));
    const c4 = chandPlat(w, game, 0, 4.5, z - 23.2);
    vanishAfter(w, game, c4, { axis: 'z', dir: -1, frac: 0.45, delay: 0.5, back: 3.2, say: 'hotel.l7.vanish' });
    const c5 = chandPlat(w, game, 0, 4.5, z - 28.2);
    w.mover(c5, (t) => ({ z: 1.7 * Math.sin(t * 0.85) }));
    const balc = deck({ x: 0, y: 4.5, z: z - 35.2, w: 9, d: 4.4, h: 0.5 });
    show.pillars(0, 4.0, z - 35.2, 9, 4.4);
    show.route(c1);
    show.route(c2, { ride: () => c2.body.x < 0.5 });
    show.route(c3);
    show.route(lift, { wait: () => lift.body.y + lift.body.hy > 2.1 + 0.6, ride: () => lift.body.y + lift.body.hy < 4.3 });
    show.route(c4);
    show.route(c5, { wait: () => c5.body.z < zA - 28.2 - 0.2, ride: () => c5.body.z > zA - 28.2 - 0.9 });
    show.route(balc, { save: { x: 0, y: 4.5, z: z - 35.2 } });
    show.z = z - 39.2;

    // ===== 3 · Speed & Sound =========================================================================================
    show.stage(NAMES[2]);
    show.round({ q: ask(['keys', 'hotel']), timer: 12, stones: 1, say: 'hotel.l7.r.timer', header: H(4, ' · 12 SECONDS') });
    const q5 = ask(['dyn2', 'f1', 'hotel'], 4) || ask(['hotel'], 4);
    const decoy = L[pick(q5.answers.map((a, i) => (a.correct ? -1 : i)).filter((i) => i >= 0))];
    show.round({ q: q5, claim: decoy, say: 'hotel.l7.r.four', header: H(5) });
    const q6 = { q: 'At Round 2, which answer\ndid I swear was correct?', answers: ['A', 'B', 'C'].map((t) => ({ text: t, correct: t === r2.lieLetter })) };
    show.round({ q: q6, say: 'hotel.l7.r.call', header: H(6, ' · THINK BACK') });

    // ===== 4 · The Balcony ===========================================================================================
    z = show.z;
    const dockB = deck({ x: 0, y: 0, z: z - 2.5, w: 9, d: 5, h: 0.6 });
    show.pillars(0, -0.6, z - 2.5, 9, 5);
    show.stage(NAMES[3], { at: { x: 0, y: 0, z: z - 2.5 }, say: 'hotel.l7.balcony', width: 9 });
    show.route(dockB);
    const belt = w.conveyor(w.plat({ x: 0, y: 0, z: z - 10.2, w: 3.4, d: 9, h: 0.4, tex: 'metal', color: 0x3a3440, roughness: 0.5 }), { vz: 3.4 });
    show.pillars(0, -0.4, z - 10.2, 3.4, 9, { r: 0.22 });
    w.sign({ text: '◂ THIS BELT RUNS TOWARDS YOU ▸', x: 0, y: 0.22, z: z - 6.4, w: 3, h: 0.6, rotX: -Math.PI / 2, color: '#f1d28a', double: false, tw: 1024, size: 56 });
    show.route(belt);
    const zB = z;
    const landB = deck({ x: 0, y: 0, z: z - 17.4, w: 5, d: 3.4, h: 0.6 });
    show.pillars(0, -0.6, z - 17.4, 5, 3.4);
    show.route(landB);
    const ferry = w.plat({ x: 0, y: 0, z: z - 25.0, w: 3.4, d: 3.4, h: 0.4, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.05 });
    w.mover(ferry, (t) => ({ z: 3.0 * Math.sin(t * 0.6) }));
    for (const sx of [-1, 1]) w.box({ x: sx * 1.9, y: -0.3, z: z - 25.0, w: 0.1, h: 0.1, d: 9.4, color: GOLD, metal: 1, rough: 0.3, shadow: false });
    ferry.attach(w.sign({ text: 'LUGGAGE LIFT', x: 0, y: 0.22, z: z - 25.0, w: 2.6, h: 0.5, rotX: -Math.PI / 2, color: '#f1d28a', double: false, tw: 512, size: 56 }));
    show.route(ferry, { wait: () => ferry.body.z < zB - 25.0 + 2.2, ride: () => ferry.body.z > zB - 25.0 - 2.2 });
    const tiles = [0, 1, 2].map((i) => {
      const t = w.crumble(w.plat({ x: 0, y: 0, z: z - 32.4 - i * 3.3, w: 2.6, d: 2.3, h: 0.4, tex: 'marble', color: 0xd9c9a8, roughness: 0.3, radius: 0.05, trim: GOLD }), { delay: 0.8, gone: 3 });
      show.pillars(0, -0.4, z - 32.4 - i * 3.3, 2.6, 2.3, { r: 0.18 });
      show.route(t);
      return t;
    });
    twistZone(game, w, { x: 0, y: 1.2, z: z - 35.7, w: 8, h: 2.6, d: 9 }, 'mouseX', { sec: 4, say: 'hotel.l7.mirror' });
    const cablePad = deck({ x: 0, y: 0, z: z - 46.5, w: 7, d: 10, h: 0.6 });
    show.pillars(0, -0.6, z - 46.5, 7, 10);
    const cable = w.hazard({ x: 0, y: 0.2, z: z - 46.5, w: 6.2, h: 0.4, d: 0.5, color: 0xff5a4a, move: (t) => ({ z: 2.8 * Math.sin(t * 0.6) }) });
    cable.core.visible = false; cable.shell.visible = false; cable.jumpable = true;
    cableDrum(cable.group);
    show.route(cablePad);
    const endB = deck({ x: 0, y: 0, z: z - 54.5, w: 7, d: 4, h: 0.6 });
    show.pillars(0, -0.6, z - 54.5, 7, 4);
    trollCheckpoint(w, game, { x: 0, y: 0, z: z - 54.5, mode: 'expire', ttl: 20, say: 'hotel.l7.expired' });
    show.route(endB, { save: { x: 0, y: 0, z: z - 54.5 } });
    show.z = z - 58.3;

    // ===== 5 · The Final Three =======================================================================================
    show.stage(NAMES[4], { say: 'hotel.l7.final' });
    show.round({ q: ask(['none']), none: true, say: 'hotel.l7.r.none', header: H(7) });
    show.round({ q: ask(['two'], 4), double: true, say: 'hotel.l7.r.double', header: H(8, ' · DOUBLE OR NOTHING') });
    const swQ = ask(['keys', 'sense', 'hotel']);
    show.round({ q: ask(['keys', 'hotel']), switch: swQ, say: 'hotel.l7.r.switch', header: H(9) });

    // ---- the trophy table: the host says you have won -------------------------------------------------------------------
    z = show.z;
    const lobby = deck({ x: 0, y: 0, z: z - 6, w: 20, d: 12, h: 1.4, tex: 'carpet', color: 0x2a3a8a });
    show.pillars(0, -1.4, z - 6, 18, 12);
    show.route(lobby, { save: { x: 0, y: 0, z: z - 2.5 } });
    w.plat({ x: -5, y: 1.0, z: z - 9.2, w: 6, d: 1.6, h: 0.2, tex: 'marble', color: 0xece3cf, roughness: 0.2, radius: 0.05 });
    w.plat({ x: -5, y: 0.8, z: z - 9.2, w: 5.6, d: 1.3, h: 1.6, tex: 'wood', color: 0xffffff, roughness: 0.3, radius: 0.05 });
    const trophy = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.18, 0.9, 12), plainMaterial(GOLD, { metalness: 1, roughness: 0.2 })); trophy.position.set(-5, 1.55, z - 9.2); w.add(trophy);
    w.sign({ text: 'CHAMPION', x: -5, y: 4.2, z: z - 10.2, w: 7, h: 1.5, color: '#f1d28a', double: false, tw: 1024, size: 130 });
    let bonusOn = false;
    const z0b = z;
    const deskGoal = w.goal({ x: 3, y: 0, z: z - 6.5, color: GOLD, onReach: () => {
      if (!fakeComplete(game, w, { title: 'CHAMPION!', sub: 'Trivia Night · Undisputed', say: 'hotel.l7.fakewin', then: openBonus })) game.completeLevel();
    } });

    // ===== 6 · The Tie-Breaker (only there once the trophy has lied to you) ===========================================================
    const bridge = [[-2.5, 0.9, -15.5], [2.5, 1.8, -19.7], [-2.0, 2.7, -23.9], [0.8, 2.7, -28.0], [3.2, 2.7, -32.4]].map(([x, y, dz]) => {
      const p = chandPlat(w, game, x, y, z + dz, 2.6); bonusPlats.push(p); return p;
    });
    w.mover(bridge[1], (t) => ({ x: 1.6 * Math.sin(t * 1.0 + 1) }));
    w.mover(bridge[4], (t) => ({ z: 1.4 * Math.sin(t * 0.9) }));
    vanishAfter(w, game, bridge[3], { axis: 'x', dir: 1, frac: 0.45, delay: 0.5, back: 3.2, say: 'hotel.l7.vanish' });
    show.z = z - 36.6;
    const regStage = show.stage(NAMES[5], { say: 'hotel.l7.tiebreak' });
    bridge.forEach((p, i) => show.route(p, i === 4 ? { wait: () => bridge[4].body.z < z0b - 32.4 + 0.5, ride: () => bridge[4].body.z > z0b - 32.4 - 0.8 } : i === 1 ? { wait: () => bridge[1].body.x > 2.0, ride: () => bridge[1].body.x > 1.3 } : {}));
    const rLast = show.round({ q: ask(['hotel', 'host', 'sense']), y: 2.7, poll: true, say: 'hotel.l7.r.poll', header: H(10, ' · TIE-BREAKER'), carpet: 0xd8c7ff, palms: false, onEnter: undefined });
    z = show.z;
    const fin = deck({ x: 0, y: 2.7, z: z - 4, w: 12, d: 8, h: 0.8 });
    bonusPlats.push(fin);
    bonusMeshes.push(...show.pillars(0, 1.9, z - 4, 12, 8));
    const finalGoal = w.goal({ x: 0, y: 2.7, z: z - 5, color: GOLD, onReach: () => { game.say('hotel.l7.done', { priority: 2 }); game.completeLevel(); } });
    finalGoal.group.visible = false; finalGoal.trig.enabled = false;
    w.goalObj = deskGoal;
    const setBonus = (on) => {
      for (const p of bonusPlats) p.setEnabled(on);
      for (const m of bonusMeshes) m.visible = on;
      show.setHidden(rLast, !on);
    };
    setBonus(false);
    // the bridge chandeliers hang from the ceiling: hide their chains with them
    function openBonus() {
      bonusOn = true;
      setBonus(true);
      for (const p of bridge) w.burst(new THREE.Vector3(p.body.x, p.top + 0.3, p.body.z), GOLD, 10, 3);
      deskGoal.group.visible = false; deskGoal.trig.enabled = false;
      finalGoal.group.visible = true; finalGoal.trig.enabled = true; w.goalObj = finalGoal;
    }
    void regStage;

    // ---- the host ------------------------------------------------------------------------------------------------
    show.onStage = (i) => {
      if (i === 1) survey(game, w, { title: 'HOW IS TRIVIA NIGHT?', lines: ['You have answered three questions.', 'Rate the evening so far: 1 – 5', 'There is no 0. We checked.'], thanks: 'Thank you! Your feedback has been filed under "B".', say: 'hotel.l7.survey' });
      if (i === 4) crash(game, w, { sec: 3, say: 'hotel.l7.crash', sayAfter: 'hotel.l7.crash.after' });
    };
    onLand(w, game, lobby, 'hotel.l7.trophy');
    let intro = false, t0 = 0, lastWrong = -9;
    for (const st of show.rounds) { const o = st.spec.onWrong; st.spec.onWrong = (s, p) => { lastWrong = w.t; o?.(s, p); }; }
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) {
        intro = true;
        g.say('hotel.l7.intro'); g.say('hotel.l7.intro2');
        g.say('hotel.l7.r.honest', { vars: { letter: show.rounds[0].claim } });
        stageTitle(g, w, 1, NAMES.length, NAMES[0]);
      }
    };
    w.hooks.onDeath = ({ deaths }) => {
      if (w.t - lastWrong < 4) return true;                                    // the "wrong!" line already said it
      if (deaths === 3) { game.say('hotel.l7.die.count', { priority: 1, vars: { n: deaths } }); return true; }
      const s = show.curStage();
      if (s === 1) { game.say('hotel.l7.die.hop', { priority: 1 }); return true; }
      if (s === 3) { game.say('hotel.l7.die.belt', { priority: 1 }); return true; }
      return false;
    };
    // the hint: honest, and only ever as far as the next thing
    const baseHint = w.hintFn;
    const pt = (o, dy = 0.15) => ({ x: o.x, y: o.y + dy, z: o.z });
    const top = (p) => ({ x: p.body.x, y: p.top + 0.15, z: p.body.z });
    w.hintFn = (g) => {
      const p = g.player;
      if (show.cleared >= NQ - 1 && !bonusOn) return [pt(p), pt(deskGoal)];
      if (bonusOn && !rLast.reached) return [pt(p), ...bridge.map(top), { x: 0, y: 2.85, z: rLast.zc }];
      if (bonusOn && show.cleared >= NQ) return [pt(p), pt(finalGoal)];
      return baseHint(g);
    };

    // ---- the bot: the runner plays the rounds; the trophy needs a nudge --------------------------------------------------
    w.botPlan = (g) => {
      const base = show.bot(g);
      if (g.frozen || g.modal) return base;
      if (show.cleared >= NQ - 1 && !bonusOn) return { x: deskGoal.x, z: deskGoal.z };
      if (bonusOn && show.cleared >= NQ) return { x: finalGoal.x, z: finalGoal.z };
      return base;
    };
    w.trivia = { show, lieLetter: r2.lieLetter, decoy, c2, c4, c5, belt, tiles, cable, deskGoal, finalGoal, bridge, rLast, lobby, get bonusOn() { return bonusOn; } };
  },
};

// ---- pieces ------------------------------------------------------------------------------------------------------------
/** "Say this once when you first land on that platform." */
function onLand(w, game, plat, key) {
  let said = false;
  w.onUpdate(() => { if (!said && game.state === 'playing' && game.player.grounded && game.player.ground === plat.body) { said = true; game.say(key, { priority: 1 }); } });
}

/** A chandelier you can stand on: a brass ring-plate with crystals, hanging from a chain to the ceiling (the chain travels with it). */
function chandPlat(w, game, x, y, z, wd = 2.4) {
  const p = w.plat({ x, y, z, w: wd, d: 2.4, h: 0.3, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.06 });
  p.o.moving = true; p.group.matrixAutoUpdate = true;
  const gold = plainMaterial(GOLD, { metalness: 1, roughness: 0.28 });
  const len = 13 - y;
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), gold); chain.position.set(0, len / 2, 0); p.group.add(chain);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(Math.min(wd, 2.4) * 0.52, 0.05, 6, 28), glowMaterial(0xffdca0, 1.8)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.16; p.group.add(rim);
  const crys = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.1, emissive: 0xfff0d8, emissiveIntensity: 0.5 })); crys.position.y = -0.55; p.group.add(crys);
  void game;
  return p;
}

/** A rolling cable drum, lying across the stage. */
function cableDrum(group) {
  const wood = plainMaterial(0x6a4a2a, { roughness: 0.7 }), cable = plainMaterial(0x15151a, { roughness: 0.5 });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.6, 14), cable); core.rotation.z = Math.PI / 2; group.add(core);
  for (const sx of [-1, 1]) { const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 16), wood); disc.rotation.z = Math.PI / 2; disc.position.x = sx * 3.0; group.add(disc); }
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.05, 0.05), glowMaterial(0xff5a4a, 1.4)); stripe.position.y = 0.12; group.add(stripe);
}
