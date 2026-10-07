import { hotelEnv, roomShell, chandelier, GOLD } from './kit.js';
import { pickQuestion, quizHall } from './quiz.js';

// Hotel level 2 — "Check-In" (Easy · Mezzanine). A game-show registration desk: four questions, three answer pads each.
// Stand on an answer for a second to sign it. Right: the gate opens. Wrong: the pad is "corrected". The host is honest
// exactly once. Questions are about things any player can know (see quiz.js), so nobody is locked out by a question.

const PERIOD = 16;            // z distance between two islands' north edges
const ISLAND_D = 7;
const Z0 = 4;                 // north edge of the first island

export default {
  id: 'hotel-2',
  name: 'Check-In',
  music: 'hotel',
  completeQuip: 'You\'re checked in. The room is a lie. The form was real.',

  build(w, game) {
    hotelEnv(w);
    w.spawn = { x: 0, y: 0, z: Z0 + 4.5, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -8;
    const zEnd = Z0 - 4 * PERIOD - 5;   // north edge of the final island (it is deeper)
    const hall = roomShell(w, { x0: -14, x1: 14, z0: zEnd - 4, z1: Z0 + 9, yb: -10 });
    // the pit under the stage
    w.plat({ x: 0, y: -9.5, z: hall.cz, w: 28, d: hall.D, h: 1, tex: 'carpet', color: 0x3a0e18, roughness: 0.95 });
    w.hazard({ x: 0, y: -7.6, z: hall.cz, w: 28, h: 0.4, d: hall.D, color: 0xff2040 }).core.material.opacity = 0.0;
    for (let k = 0; k < 5; k++) chandelier(w, 0, 9.6, Z0 + 4 - k * PERIOD, k === 4 ? 0.9 : 0.75);

    // ---- the quiz: four questions, one gimmick each ----------------------------------------------------------
    const finale = { q: 'What is the answer\nto this question?', answers: [{ text: 'This one', correct: true }, { text: 'That one', correct: false }, { text: 'Not this one', correct: false }].sort(() => Math.random() - 0.5) };
    const quiz = quizHall(w, game, {
      Z0, period: PERIOD, islandD: ISLAND_D,
      stages: [
        { q: pickQuestion(game, ['keys']), gimmick: 'honest' },
        { q: pickQuestion(game, ['l1']), gimmick: 'lie' },
        { q: pickQuestion(game, ['pilot', 'dyn', 'hotel']), gimmick: 'breathe' },
        { q: finale, gimmick: 'honest' },
      ],
      lines: { right: 'hotel.l2.right', rightLast: 'hotel.l2.right.last', wrong: 'hotel.l2.wrong', wrongLie: 'hotel.l2.wrong.lie', hint: 'hotel.l2.hint', hintNone: 'hotel.l2.hint.none', stage: (k, st) => [`hotel.l2.s${k}`, { letter: st.lieLetter || st.correctPad.letter, text: st.correctPad.text }] },
    });
    const { stages, fin } = quiz;

    // the final island: the desk, the bell, the goal
    w.plat({ x: 0, y: 1.1, z: fin.zN + 2.2, w: 9, d: 1.4, h: 0.2, tex: 'marble', color: 0xece3cf, roughness: 0.2, radius: 0.05 });
    w.plat({ x: 0, y: 0.9, z: fin.zN + 2.2, w: 8.6, d: 1.1, h: 1.8, tex: 'wood', color: 0xffffff, roughness: 0.3, radius: 0.05 });
    w.sign({ text: 'CHECK-IN', x: 0, y: 4.2, z: fin.zN + 1.4, w: 7, h: 1.5, color: '#f1d28a', double: false, tw: 1024, size: 130 });
    w.goal({ x: 0, y: 0, z: fin.zN + 6.5, color: GOLD, onReach: () => { game.say('hotel.l2.done', { priority: 2 }); game.completeLevel(); } });

    // ---- the host ---------------------------------------------------------------------------------
    let t0 = 0, intro = false;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) {
        intro = true;
        g.say('hotel.l2.intro'); g.say('hotel.l2.intro2');
        g.say('hotel.l2.s0', { vars: { letter: stages[0].correctPad.letter } });
      }
    };
    w.hooks.onDeath = () => false;
  },
};
