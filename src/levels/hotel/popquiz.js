import * as THREE from 'three';
import { hotelEnv, roomShell, chandelier, GOLD } from './kit.js';
import { pickQuestion } from './quiz.js';
import { quizShow } from './quiz-show.js';
import { crash, fakeComplete, survey, stageTitle } from './trolls.js';

// Hotel level 18 — "Pop Quiz" (Impossible · Penthouse). FIRST FULL PASS. Fourteen rounds, no interludes, no mercy, every clock short.
//   1 Pencils Up      R1 the host lies (confidently) · R2 an 8 s clock · R3 "pick the WRONG one"
//   2 Closed Book     R4 None of the above · R5 nobody can know (take PASS) · R6 the pads breathe + 6 s
//   3 Open Season     R7 double or nothing · R8 the question changes when you sign · R9 right answer, then the floor changes its mind
//   4 The Honours     R10 the audience poll lies · R11 a 6 s clock and a lying host · R12 "pick the WRONG one" with a clock → a desk and an A+
//   ...and the A+ is a lie: two sudden-death rounds with 5 s clocks appear behind it.
// Baby Mode (from the quiz runner): slower clocks, the question never changes, wrong pads wobble long enough to hop off.

const NAMES = ['Pencils Up', 'Closed Book', 'Open Season', 'The Honours'];
const NQ = 14;

export default {
  id: 'hotel-18',
  name: 'Pop Quiz',
  music: 'hotel_ballroom',
  completeQuip: 'Fourteen rounds, one A+, one sudden death. The grade stands. The grade is a ghost.',

  build(w, game) {
    hotelEnv(w);
    const Z0 = 12;
    w.spawn = { x: 0, y: 0, z: Z0 - 1.8, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -6;
    const zFar = -420;
    const hall = roomShell(w, { x0: -17, x1: 17, z0: zFar, z1: Z0 + 4, yb: -10, wallTex: 'damask', wallColor: 0xe8c8a0, pilasterEvery: 12, beamEvery: 12 });
    w.plat({ x: 0, y: -9.5, z: hall.cz, w: 34, d: hall.D, h: 1, tex: 'carpet', color: 0x2a1818, roughness: 0.95 });
    for (let z = Z0 - 6; z > zFar + 10; z -= 70) chandelier(w, 0, 9.6, z, 0.85);

    const show = quizShow(w, game, { prefix: 'hotel.l18', names: NAMES, z0: Z0, hallW: 22, carpet: 0xe0c8a0 });
    const used = new Set();
    const ask = (pools, n = 3) => pickQuestion(game, pools, { used, n });
    const H = (n, extra = '') => `ROUND ${n} OF ${NQ}${extra}`;
    const deck = (o) => w.plat({ tex: 'marble', color: 0xece3cf, roughness: 0.2, radius: 0.05, ...o });

    show.stage(NAMES[0], { flag: false });
    show.round({ q: ask(['keys']), claim: 'lie', say: 'hotel.l18.r.lie', header: H(1) });
    show.round({ q: ask(['keys', 'hotel']), timer: 8, say: 'hotel.l18.r.timer', header: H(2, ' · 8 SECONDS') });
    show.round({ q: ask(['f1', 'hotel']), flip: true, say: 'hotel.l18.r.flip', header: H(3, ' · PICK A WRONG ONE') });

    show.stage(NAMES[1]);
    show.round({ q: ask(['none']), none: true, say: 'hotel.l18.r.none', header: H(4) });
    show.round({ q: ask(['unknowable']), pass: true, say: 'hotel.l18.r.pass', header: H(5, ' · NOBODY KNOWS') });
    show.round({ q: ask(['keys', 'sense']), breathe: 1, timer: 6, say: 'hotel.l18.r.timer', header: H(6, ' · 6 SECONDS') });

    show.stage(NAMES[2]);
    show.round({ q: ask(['two'], 4), double: true, say: 'hotel.l18.r.double', header: H(7, ' · DOUBLE OR NOTHING') });
    const swQ = ask(['keys', 'sense', 'hotel']);
    show.round({ q: ask(['keys', 'hotel']), switch: swQ, say: 'hotel.l18.r.switch', header: H(8) });
    show.round({ q: ask(['f2', 'hotel']), mind: true, say: 'hotel.l18.r.mind', header: H(9) });

    show.stage(NAMES[3]);
    show.round({ q: ask(['hotel', 'host', 'sense']), poll: true, say: 'hotel.l18.r.poll', header: H(10) });
    show.round({ q: ask(['keys', 'hotel']), claim: 'lie', timer: 6, say: 'hotel.l18.r.lie', header: H(11, ' · 6 SECONDS') });
    show.round({ q: ask(['f1', 'sense']), flip: true, timer: 7, say: 'hotel.l18.r.flip', header: H(12, ' · PICK A WRONG ONE') });

    // ---- the A+ (a lie), then sudden death ---------------------------------------------------------------------------
    let z = show.z;
    const bonusPlats = [];
    const desk = deck({ x: 0, y: 0, z: z - 12, w: 20, d: 24, h: 1.4, tex: 'carpet', color: 0x3a2a1a });
    show.route(desk, { save: { x: 0, y: 0, z: z - 2.5 } });
    show.pillars(0, -1.4, z - 12, 18, 24);
    let bonusOn = false;
    const deskGoal = w.goal({ x: 3, y: 0, z: z - 6.5, color: GOLD, onReach: () => {
      if (!fakeComplete(game, w, { title: 'A+', sub: 'Pop Quiz · Honours', say: 'hotel.l18.fakewin', then: openBonus })) game.completeLevel();
    } });
    show.z = z - 24;
    show.stage('Sudden Death', { say: 'hotel.l18.sudden' });
    const r13 = show.round({ q: ask(['none']), none: true, timer: 5, say: 'hotel.l18.r.none', header: H(13, ' · SUDDEN DEATH · 5 SECONDS') });
    const r14 = show.round({ q: ask(['keys', 'hotel', 'sense']), flip: true, timer: 5, say: 'hotel.l18.r.flip', header: H(14, ' · SUDDEN DEATH · 5 SECONDS') });
    z = show.z;
    const fin = deck({ x: 0, y: 0, z: z - 4, w: 12, d: 8, h: 1.4, tex: 'carpet', color: 0x3a2a1a });
    bonusPlats.push(fin);
    const bm = show.pillars(0, -1.4, z - 4, 12, 8);
    const finalGoal = w.goal({ x: 0, y: 0, z: z - 5, color: GOLD, onReach: () => { game.say('hotel.l18.done', { priority: 2 }); game.completeLevel(); } });
    finalGoal.group.visible = false; finalGoal.trig.enabled = false;
    w.goalObj = deskGoal;
    const setBonus = (on) => { for (const p of bonusPlats) p.setEnabled(on); for (const m of bm) m.visible = on; show.setHidden(r13, !on); show.setHidden(r14, !on); };
    setBonus(false);
    function openBonus() {
      bonusOn = true; setBonus(true);
      deskGoal.group.visible = false; deskGoal.trig.enabled = false;
      finalGoal.group.visible = true; finalGoal.trig.enabled = true; w.goalObj = finalGoal;
    }

    show.onStage = (i) => {
      if (i === 2) survey(game, w, { title: 'HOW IS THE EXAM?', lines: ['You have answered six questions.', 'Rate the exam so far: 1 – 5', 'There is no 0. We checked.'], thanks: 'Thank you! Your feedback has been marked.', say: 'hotel.l18.survey' });
      if (i === 3) crash(game, w, { sec: 3, say: 'hotel.l18.crash', sayAfter: 'hotel.l18.crash.after' });
    };
    let intro = false, t0 = 0;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l18.intro'); stageTitle(g, w, 1, NAMES.length, NAMES[0]); }
    };
    const baseHint = w.hintFn;
    w.hintFn = (g) => {
      const p = g.player, pt = (o) => ({ x: o.x, y: o.y + 0.15, z: o.z });
      if (show.cleared >= 12 && !bonusOn) return [pt(p), pt(deskGoal)];
      if (bonusOn && show.cleared >= NQ) return [pt(p), pt(finalGoal)];
      return baseHint(g);
    };
    w.botPlan = (g) => {
      const base = show.bot(g);
      if (g.frozen || g.modal) return base;
      if (show.cleared >= 12 && !bonusOn) return { x: deskGoal.x, z: deskGoal.z };
      if (bonusOn && show.cleared >= NQ) return { x: finalGoal.x, z: finalGoal.z };
      return base;
    };
    w.pop = { show, deskGoal, finalGoal, get bonusOn() { return bonusOn; } };
  },
};
