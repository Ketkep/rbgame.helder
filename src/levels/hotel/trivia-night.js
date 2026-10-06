import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, chandelier, hotelHalo, GOLD } from './kit.js';
import { pickQuestion, quizHall } from './quiz.js';

// Hotel level 7 — "Trivia Night" (Medium · Ballroom). A game-show in the grand ballroom: six rounds, a new trick each.
// 1 honest · 2 the host lies · 3 the answers slide · 4 a 12-second clock · 5 four answers (and reverse psychology) ·
// 6 "which answer did I swear was right in round 2?" The audience is real. They are mostly furniture.

const PERIOD = 16, ISLAND_D = 7, Z0 = 4, N = 6;
const L = ['A', 'B', 'C', 'D'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export default {
  id: 'hotel-7',
  name: 'Trivia Night',
  music: 'hotel_ballroom',
  completeQuip: 'Six rounds. The audience is on its feet. Mostly because the chairs are bolted to a different floor.',

  build(w, game) {
    hotelEnv(w);
    w.spawn = { x: 0, y: 0, z: Z0 + 4.5, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -5.2;
    const zEnd = Z0 - N * PERIOD - 5;
    const hall = roomShell(w, { x0: -17, x1: 17, z0: zEnd - 4, z1: Z0 + 9, yb: -10, wallTex: 'damask', wallColor: 0x8da4e8, pilasterEvery: 12 });
    // the audience floor, one level down: round tables, candles, and nobody in the seats
    w.plat({ x: 0, y: -6, z: hall.cz, w: 34, d: hall.D, h: 1, tex: 'carpet', color: 0x1f2a58, roughness: 0.95 });
    for (let z = Z0 + 2; z > zEnd; z -= 8) for (const sx of [-1, 1]) {
      const x = sx * 13.2;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.1, 22), plainMaterial(0xf4ecd8, { roughness: 0.6 })); top.position.set(x, -4.1, z); w.add(top);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.0, 10), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); stem.position.set(x, -5.1, z); w.add(stem);
      const cloth = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.6, 22), plainMaterial(0xf4ecd8, { roughness: 0.7 })); cloth.position.set(x, -4.35, z); w.add(cloth);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glowMaterial(0xffc060, 2.2)); flame.position.set(x, -3.85, z); w.add(flame);
      hotelHalo(w, x, -3.8, z, 2.2, 0xffc070, 0.35);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; const ch = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.6), plainMaterial(0x7a1f2a, { roughness: 0.6 })); ch.position.set(x + Math.cos(a) * 2.3, -5.4, z + Math.sin(a) * 2.3); w.add(ch); }
    }
    for (let k = 0; k < N; k += 2) chandelier(w, 0, 9.6, Z0 + 4 - k * PERIOD, 0.85);
    chandelier(w, 0, 9.6, zEnd + 5, 0.9);
    // a disco ball for the vibes
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 2), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.08, flatShading: true, emissive: 0x222233 }));
    ball.position.set(0, 9.8, Z0 - 2 * PERIOD - 4); w.add(ball);
    w.onUpdate((dt) => { ball.rotation.y += dt * 0.8; });

    // ---- the six rounds -----------------------------------------------------------------------------------
    const used = new Set();
    const q2 = pickQuestion(game, ['f1', 'hotel'], { used });
    const wrongIdx = q2.answers.map((a, i) => (a.correct ? -1 : i)).filter((i) => i >= 0);
    const lieLetter = L[pick(wrongIdx)];
    const q5 = pickQuestion(game, ['dyn2', 'f1', 'hotel'], { n: 4, used }) || pickQuestion(game, ['hotel'], { n: 3, used });
    const q6 = { q: 'At Question 2, which answer\ndid I swear was correct?', answers: ['A', 'B', 'C'].map((t) => ({ text: t, correct: t === lieLetter })) };
    const decoy = L[pick(q5.answers.map((a, i) => (a.correct ? -1 : i)).filter((i) => i >= 0))];
    const quiz = quizHall(w, game, {
      Z0, period: PERIOD, islandD: ISLAND_D, hallW: 22, carpet: 0xc6d2ff,
      stages: [
        { q: pickQuestion(game, ['keys'], { used }), gimmick: 'honest', header: 'ROUND 1 OF 6' },
        { q: q2, gimmick: 'lie', lieLetter, header: 'ROUND 2 OF 6' },
        { q: pickQuestion(game, ['f1', 'dyn2', 'hotel'], { used }), gimmick: 'slide', header: 'ROUND 3 OF 6' },
        { q: pickQuestion(game, ['keys', 'hotel'], { used }), gimmick: 'timer', limit: 12, header: 'ROUND 4 OF 6 · 12 SECONDS' },
        { q: q5, gimmick: 'honest', header: 'ROUND 5 OF 6' },
        { q: q6, gimmick: 'honest', header: 'FINAL ROUND' },
      ],
      lines: {
        right: 'hotel.l7.right', rightLast: 'hotel.l7.right.last', wrong: 'hotel.l7.wrong', wrongLie: 'hotel.l7.wrong.lie', hint: 'hotel.l7.hint', hintNone: 'hotel.l7.hint.none', timeUp: 'hotel.l7.timeup',
        stage: (k, st) => [`hotel.l7.s${k}`, { letter: k === 1 ? lieLetter : k === 4 ? decoy : st.correctPad.letter, text: st.correctPad.text }],
      },
    });
    const { stages, fin } = quiz;
    const stage5Decoy = decoy;

    // the end of the show: the trophy table and the exit
    w.plat({ x: 0, y: 1.0, z: fin.zN + 2.4, w: 8, d: 1.6, h: 0.2, tex: 'marble', color: 0xece3cf, roughness: 0.2, radius: 0.05 });
    w.plat({ x: 0, y: 0.8, z: fin.zN + 2.4, w: 7.6, d: 1.3, h: 1.6, tex: 'wood', color: 0xffffff, roughness: 0.3, radius: 0.05 });
    const trophy = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.18, 0.9, 12), plainMaterial(GOLD, { metalness: 1, roughness: 0.2 })); trophy.position.set(0, 1.55, fin.zN + 2.4); w.add(trophy);
    w.sign({ text: 'CHAMPION', x: 0, y: 4.2, z: fin.zN + 1.4, w: 7, h: 1.5, color: '#f1d28a', double: false, tw: 1024, size: 130 });
    w.goal({ x: 0, y: 0, z: fin.zN + 6.5, color: GOLD, onReach: () => { game.say('hotel.l7.done', { priority: 2 }); game.completeLevel(); } });

    // ---- the host ------------------------------------------------------------------------------------------------
    let t0 = 0, intro = false;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      if (!intro && t0 > 1.2) {
        intro = true;
        g.say('hotel.l7.intro'); g.say('hotel.l7.intro2');
        g.say('hotel.l7.s0', { vars: { letter: stages[0].correctPad.letter, text: stages[0].correctPad.text } });
      }
    };
    w.hooks.onDeath = () => false;
    w.trivia = { lieLetter, decoy: stage5Decoy };
  },
};
