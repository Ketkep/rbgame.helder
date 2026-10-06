import * as THREE from 'three';
import { plainMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, chandelier, GOLD } from './kit.js';
import { palm } from './props.js';
import { pickQuestion, boardMesh, makePad, makeGate } from './quiz.js';

// Hotel level 2 — "Check-In" (Easy · Mezzanine). A game-show registration desk: four questions, three answer pads each.
// Stand on an answer for a second to sign it. Right: the gate opens. Wrong: the pad is "corrected". The host is honest
// exactly once. Questions are about things any player can know (see quiz.js), so nobody is locked out by a question.

const SLOTS = [-4.6, 0, 4.6];
const LETTERS = ['A', 'B', 'C'];
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

    // ---- islands -------------------------------------------------------------------------------
    const islands = [];
    const island = (zN, depth = ISLAND_D) => {
      const zc = zN + depth / 2;
      const p = w.plat({ x: 0, y: 0, z: zc, w: 19, d: depth, h: 1.4, tex: 'carpet', color: 0xffffff, roughness: 0.92, radius: 0.05, trim: GOLD });
      w.box({ x: 0, y: -0.7, z: zc, w: 19.4, h: 0.12, d: depth + 0.4, color: GOLD, metal: 1, rough: 0.3, shadow: false });
      for (const sx of [-1, 1]) palm(w, sx * 8.2, zc, 1.0);
      islands.push({ zN, zS: zN + depth, zc, plat: p });
      return p;
    };
    island(Z0);
    for (let k = 1; k <= 3; k++) island(Z0 - k * PERIOD);
    island(zEnd, 12);

    // ---- questions ------------------------------------------------------------------------------
    const specs = [
      { pools: ['keys'], gimmick: 'honest' },
      { pools: ['l1'], gimmick: 'lie' },
      { pools: ['pilot', 'dyn', 'hotel'], gimmick: 'breathe' },
      { pools: ['hotel'], gimmick: 'finale' },
    ];
    const stages = specs.map((spec, k) => {
      const isl = islands[k];
      let q = pickQuestion(game, spec.pools);
      if (spec.gimmick === 'finale') {
        const ans = [{ text: 'This one', correct: true }, { text: 'That one', correct: false }, { text: 'Not this one', correct: false }];
        q = { q: 'What is the answer\nto this question?', answers: ans.sort(() => Math.random() - 0.5) };
      }
      const moving = spec.gimmick === 'breathe';
      const padZ = isl.zN - (moving ? 4.8 : 4.4);
      const pads = q.answers.map((a, i) => {
        const pad = makePad(w, { x: SLOTS[i], z: padZ, letter: LETTERS[i], text: a.text, correct: a.correct });
        const phase = (i / 3) * Math.PI * 2;
        pad.fallY = 0;
        w.mover(pad.plat, (t) => ({ y: pad.fallY, z: moving ? Math.sin(t * 1.15 + phase) * 0.6 : 0 }));
        return pad;
      });
      const gate = makeGate(w, { z: isl.zN - 8.4 });
      const board = boardMesh(w, { x: 0, y: 6.6, z: isl.zN - 8.9, width: 12, height: 3.6, header: `QUESTION ${k + 1} OF 4`, text: q.q });
      const correctPad = pads.find((p) => p.correct);
      const wrongPads = pads.filter((p) => !p.correct);
      return { k, spec, pads, gate, q, board, correctPad, wrongPads, lieLetter: null };
    });
    stages[1].lieLetter = stages[1].wrongPads[Math.floor(Math.random() * 2)].letter;

    // the final island: the desk, the bell, the goal
    const fin = islands[4];
    w.plat({ x: 0, y: 1.1, z: fin.zN + 2.2, w: 9, d: 1.4, h: 0.2, tex: 'marble', color: 0xece3cf, roughness: 0.2, radius: 0.05 });
    w.plat({ x: 0, y: 0.9, z: fin.zN + 2.2, w: 8.6, d: 1.1, h: 1.8, tex: 'wood', color: 0xffffff, roughness: 0.3, radius: 0.05 });
    w.sign({ text: 'CHECK-IN', x: 0, y: 4.2, z: fin.zN + 1.4, w: 7, h: 1.5, color: '#f1d28a', double: false, tw: 1024, size: 130 });
    w.goal({ x: 0, y: 0, z: fin.zN + 6.5, color: GOLD, onReach: () => { game.say('hotel.l2.done', { priority: 2 }); game.completeLevel(); } });

    // ---- state ----------------------------------------------------------------------------------
    let cleared = 0;
    // only the current question (and the one behind it) is on show; the rest is revealed as the gates open
    const reveal = () => stages.forEach((st) => { const on = st.k <= cleared; st.board.visible = on; st.pads.forEach((p) => { p.tag.visible = on; }); });
    reveal();
    const cur = () => stages[cleared];
    const resetPad = (pad) => {
      pad.set('idle'); pad.lockT = 0; pad.dropT = 0; pad.fallY = 0; pad.vy = 0; pad.eliminated = false;
      pad.plat.setEnabled(true); pad.plat.group.scale.setScalar(1);
    };
    const dropPad = (pad) => { pad.set(pad.state === 'wrong' ? 'wrong' : 'gone'); pad.falling = true; pad.vy = 0; };
    w.onRespawn(() => { for (let k = cleared; k < 4; k++) { stages[k].pads.forEach((p) => { p.falling = false; resetPad(p); }); } });

    const resolve = (st, pad) => {
      if (pad.correct) {
        pad.set('right'); st.gate.open(); cleared = st.k + 1; reveal();
        game.audio.ding(); game.ui.toast('✔ Correct', 'gold');
        game.say(st.k === 3 ? 'hotel.l2.right.last' : 'hotel.l2.right', { priority: 2 });
      } else {
        pad.set('wrong'); pad.dropT = 0; game.audio.buzzer();
        game.say(st.lieLetter && pad.letter === st.lieLetter ? 'hotel.l2.wrong.lie' : 'hotel.l2.wrong', { priority: 2 });
      }
    };

    w.onUpdate((dt, t) => {
      for (const s of stages) s.gate.update(dt);
      const pl = game.player;
      for (const st of stages) {
        for (const pad of st.pads) {
          pad.pulse(t);
          if (pad.falling) {
            pad.vy -= 26 * dt; pad.fallY += pad.vy * dt;
            if (pad.fallY < -2.5) pad.plat.body.enabled = false;
            if (pad.fallY < -14) { pad.plat.setEnabled(false); pad.falling = false; }
            continue;
          }
          if (st.k !== cleared) continue;
          if (pad.state === 'wrong') { pad.dropT += dt; if (pad.dropT > 0.35) { pad.plat.body.enabled = false; pad.falling = true; pad.vy = 0; } continue; }
          if (pad.state !== 'idle' && pad.state !== 'lock') continue;
          const on = game.state === 'playing' && pl.grounded && pl.ground === pad.plat.body;
          if (on) {
            if (pad.state === 'idle') { pad.set('lock'); game.audio.tick(); }
            pad.lockT += dt;
            if (pad.lockT >= pad.dwell) resolve(st, pad);
          } else if (pad.state === 'lock') { pad.lockT = 0; pad.set('idle'); }
        }
      }
    });

    // the respawn point follows you up the hall (no flag, just a quiet save)
    for (let k = 1; k <= 4; k++) {
      const isl = islands[k];
      w.trigger({ x: 0, y: 1.5, z: isl.zN + 3, w: 17, h: 3, d: isl.zS - isl.zN - 1.5, once: true, onEnter: () => {
        w.respawn = { x: 0, y: 0, z: isl.zN + (k === 4 ? 3.5 : 3.5), yaw: 0 };
        if (k < 4) game.say(`hotel.l2.s${k}`, { priority: 1, vars: { letter: stages[k].lieLetter || stages[k].correctPad.letter, text: stages[k].correctPad.text } });
      } });
    }

    // ---- 50/50 hint: the host removes one wrong answer ----------------------------------------------
    w.hintAction = (g) => {
      const st = cur(); if (!st || cleared >= 4) return false;
      const standing = (p) => g.player.grounded && g.player.ground === p.plat.body;
      const cand = st.wrongPads.filter((p) => !p.eliminated && !standing(p) && p.state === 'idle');
      if (!cand.length) { g.say('hotel.l2.hint.none', { priority: 1 }); return false; }
      const pad = cand[Math.floor(Math.random() * cand.length)];
      pad.eliminated = true; pad.plat.body.enabled = false; pad.set('gone'); pad.falling = true; pad.vy = 0;
      g.say('hotel.l2.hint', { priority: 1 });
      return true;
    };

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
    w.quiz = { stages, get cleared() { return cleared; }, islands };
    // test bot: answer correctly, one island at a time
    w.botPlan = (g) => {
      const p = g.player, st = cur();
      if (!st) return { x: 0, z: fin.zN + 6.5 };
      if (p.grounded && p.ground === st.correctPad.plat.body) return { wait: true, x: p.x, z: p.z };
      const isl = islands[st.k];
      if (p.z > isl.zS + 0.2) return { body: isl.plat.body };
      return { body: st.correctPad.plat.body };
    };
    void plainMaterial; void THREE;
  },
};
