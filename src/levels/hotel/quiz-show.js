import * as THREE from 'three';
import { glowMaterial, plainMaterial } from '../../engine/materials.js';
import { GOLD } from './kit.js';
import { palm } from './props.js';
import { makePad, makeGate, boardMesh, clockMesh } from './quiz.js';
import { stageTitle } from './trolls.js';

// The multi-act quiz runner used by Check-In (2), Trivia Night (7) and Minibar (13).
//
// A level is a row of SEGMENTS laid out toward -z: quiz ROUNDS (an island to stand on, a question board, a row of answer
// pads, a gate) and INTERLUDES (platforming the level builds itself between two acts). Segments are grouped into STAGES
// (an act of rounds, or an interlude); every stage starts with a real checkpoint and a banner, and every round island is
// a quiet save, so a wrong answer only ever costs you that round.
//
// Every round has its own twist (spec flags, they combine):
//   claim:'right'|'lie'  the host names a letter when you arrive (honest, or a confident lie)
//   slide / breathe      the pads slide sideways / in and out
//   timer: s             a clock starts when you set foot on the island; at zero the pads leave (and come back)
//   flip                 "PICK A WRONG ANSWER": every wrong answer is right and the right one is wrong
//   none                 the real answer is "None of the above" (the level passes only wrong options)
//   pass                 nothing is right; a PASS pad on the side is (the level passes only wrong options)
//   mind                 right answer, gate opens... then the host changes his mind and the pad drops: leave quickly
//   switch: q            the question (and the answers) change the moment you commit; a short clock to re-pick
//   double               "double or nothing": two answers are right; stand on the line between them
//   poll: true           an audience poll that backs a wrong answer
//   locked               the answer tags are hidden until the level calls round.unlock() (the minibar)
// Baby Mode: the clock runs slower, wrong pads wobble long enough to hop back off, 'mind' and 'switch' never happen.
// The hint (H) is honest: inside a round it removes one wrong answer (and gives an honest tip on a twist round); between
// rounds it draws a trail, never past the next stage.

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const HALF = 0.35;   // the player's half width (physics.js MOVE.halfW)

export function quizShow(w, game, opts) {
  const { hallW = 22, carpet = 0xffffff, H = 13, prefix, names, z0 = 4, islandD = 7, spacing = 4.6, pitY = -9.5, padColor = null } = opts;
  void padColor;
  const K = (k) => `${prefix}.${k}`;
  const rounds = [], stages = [], cps = new Map();
  let cleared = 0;                                   // rounds answered (index of the live round)
  const show = { rounds, stages, z: z0, frozenSim: 0, hallW, H };
  w.quizShow = show;   // (tests and the bot read it)
  const say = (key, o = {}) => game.say(key, { priority: 1, ...o });

  // ---------------------------------------------------------------------------------------------------------------
  //  Building
  // ---------------------------------------------------------------------------------------------------------------
  /** Start a new stage at the current cursor. `at` (optional) is its respawn spot; rounds fill it in themselves. */
  show.stage = (name, { at = null, say: line = null, flag: withFlag = true, width = 8 } = {}) => {
    const i = stages.length;
    const s = { i, name: name || names?.[i] || `Stage ${i + 1}`, at, route: [], line, cp: null, rounds: [], noFlag: !withFlag };
    stages.push(s);
    if (at && withFlag) s.cp = flag(i, at.x, at.y, at.z, width);
    return s;
  };
  const flag = (i, x, y, z, width = hallW - 1) => {
    const c = w.checkpoint({ x, y, z, real: true }); cps.set(c, i);
    // the flag's own trigger is 2.4 m wide: this one spans the whole platform, so nobody walks past a stage start
    w.trigger({ x, y: y + 1.2, z, w: width, h: 3.2, d: 2.4, once: false, onEnter: () => {
      if (c.used || game.state !== 'playing') return;
      c.used = true; w.burst(new THREE.Vector3(x, y + 0.4, z), 0xffc83d, 24); game.onCheckpoint(c);
    } });
    return c;
  };
  w.hooks.onCheckpoint = (c) => {
    const i = cps.get(c);
    if (i === undefined) return;
    stageTitle(game, w, i + 1, stages.length, stages[i].name);
    if (stages[i].line) say(stages[i].line);
    show.onStage?.(i);
  };
  /** A bot/hint waypoint for the stage being built (an interlude): `body` to stand on, optional `wait(g)` / `ride(g)`. */
  show.route = (plat, o = {}) => {
    const s = stages[stages.length - 1], b = plat.body || plat;
    const node = { body: b, wait: o.wait || null, ride: o.ride || null, x: o.x, z: o.z, alt: o.alt || null, save: o.save || null };
    s.route.push(node);
    if (plat.o) plat.o.path = true;
    if (o.save) {   // a quiet save when you land on it
      w.trigger({ x: b.x, y: b.y + b.hy + 1.5, z: b.z, w: b.hx * 2 - 0.4, h: 3, d: b.hz * 2 - 0.4, once: false, onEnter: () => { if (game.state === 'playing') w.respawn = { ...o.save, yaw: 0 }; } });
    }
    return plat;
  };

  /** Support columns under a platform that otherwise hangs over the pit. */
  show.pillars = (x, y, z, wd, dp, { color = 0xece3cf, r = 0.32 } = {}) => {
    const out = [], len = y - (pitY + 0.5);
    if (len <= 0.2) return out;
    const xs = wd > 6 ? [-wd / 2 + 1.2, wd / 2 - 1.2] : [0];
    const zs = dp > 6 ? [-dp / 2 + 1.2, dp / 2 - 1.2] : [0];
    for (const dx of xs) for (const dz of zs) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, len, 14), plainMaterial(color, { roughness: 0.3 }));
      m.position.set(x + dx, pitY + 0.5 + len / 2, z + dz); m.matrixAutoUpdate = false; m.updateMatrix(); w.add(m);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.5, r * 1.2, 0.3, 14), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 }));
      cap.position.set(x + dx, y - 0.15, z + dz); cap.matrixAutoUpdate = false; cap.updateMatrix(); w.add(cap);
      out.push(m, cap);
    }
    return out;
  };
  /** A potted palm standing on a platform whose top is at `y` (props.js only knows the lobby floor). */
  show.palm = (x, y, z) => {
    const n0 = w.scene.children.length, b0 = w.bodies.length;
    palm(w, x, z, 1.0);
    const objs = w.scene.children.slice(n0), bodies = w.bodies.slice(b0);
    if (y) { for (const o of objs) { o.position.y += y; o.updateMatrix(); } for (const b of bodies) b.setCenter(b.x, b.y + y, b.z); }
    return { objs, bodies };
  };

  /** One quiz round at the cursor. Returns the round state. */
  show.round = (spec) => {
    const k = rounds.length, s = stages[stages.length - 1];
    const zS = show.z, zN = zS - islandD, zc = (zS + zN) / 2, y0 = spec.y ?? 0;
    const isl = w.plat({ x: 0, y: y0, z: zc, w: hallW, d: islandD, h: 1.4, tex: 'carpet', color: spec.carpet ?? s.carpet ?? carpet, roughness: 0.92, radius: 0.05, trim: GOLD });
    const decor = show.pillars(0, y0 - 1.4, zc, hallW - 2, islandD), decorBodies = [];
    if (spec.palms !== false) for (const sx of [-1, 1]) { const pm = show.palm(sx * (hallW / 2 - 1.3), y0, zc + 1.2); decor.push(...pm.objs); decorBodies.push(...pm.bodies); }
    // the first round of a stage carries the stage's checkpoint
    const at = { x: 0, y: y0, z: zS - 1.8 };
    if (!s.rounds.length && !s.at) { s.at = at; if (!s.noFlag) s.cp = flag(s.i, at.x, at.y, at.z); }
    const node = { body: isl.body, round: null };
    s.route.push(node);

    // ---- the question (some twists add or rewrite answers) ---------------------------------------------------
    let q = spec.q, answers = q.answers.map((a) => ({ ...a }));
    if (spec.none) answers = [...answers.map((a) => ({ text: a.text, correct: false })), { text: 'None of the above', correct: true }];
    if (spec.pass) answers = answers.map((a) => ({ text: a.text, correct: false }));
    if (spec.flip) answers = answers.map((a) => ({ text: a.text, correct: !a.correct }));
    if (spec.double) {   // the two right answers sit side by side
      const right = answers.filter((a) => a.correct).slice(0, 2), wrong = answers.filter((a) => !a.correct);
      const at2 = Math.floor(Math.random() * (wrong.length + 1));
      answers = [...wrong.slice(0, at2), ...right, ...wrong.slice(at2)];
    }
    const n = answers.length;
    const rows = spec.stones || 0, extra = rows * 2.7;     // stepping stones between the island and the answers
    const reach = (spec.breathe ? 4.8 : 4.4) + extra;
    const padZ = zN - reach, padY = y0 + (spec.padDy || 0);
    const sp = spec.double ? 3.4 : spacing;
    const stones = [];
    for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
      const sx = (i - (n - 1) / 2) * sp + (r % 2 ? 1.1 : -1.1), sz = zN - 1.9 - r * 2.7;
      const stone = w.plat({ x: sx, y: y0, z: sz, w: 1.7, d: 1.6, h: 0.5, tex: 'marble', color: 0xc9b8e8, roughness: 0.25, radius: 0.06, trim: GOLD });
      show.pillars(sx, y0 - 0.5, sz, 1.7, 1.6, { r: 0.16 });
      (stones[r] ||= [])[i] = stone;
    }
    const pads = answers.map((a, i) => {
      const pad = makePad(w, { x: (i - (n - 1) / 2) * sp, z: padZ, y: padY, letter: LETTERS[i], text: a.text, correct: a.correct });
      pad.fallY = 0; pad.k = k;
      const phase = (i / n) * Math.PI * 2;
      w.mover(pad.plat, (t) => ({ y: pad.fallY, z: spec.breathe ? Math.sin(t * 1.15 + phase) * 0.6 : 0, x: spec.slide ? Math.sin(t * (spec.slideRate || 1.0) + k) * (spec.slide === true ? 1.2 : spec.slide) : 0 }));
      piston(pad.plat, padY - 0.6 - (pitY + 0.5));
      return pad;
    });
    if (spec.pass) {   // the way out nobody mentions
      const px = ((n - 1) / 2) * sp + sp * 0.5 + 3.0;
      const pass = makePad(w, { x: px, z: padZ, y: padY, wd: 3.0, dp: 3.2, letter: 'P', text: 'PASS', correct: true, tagW: 2.8 });
      pass.fallY = 0; pass.k = k; pass.pass = true;
      w.mover(pass.plat, () => ({ y: pass.fallY }));
      piston(pass.plat, padY - 0.6 - (pitY + 0.5));
      pads.push(pass);
    }
    if (spec.double) seams(pads, padY, padZ);
    const zG = zN - 8.4 - extra, zB = zN - 8.9 - extra;
    const gate = makeGate(w, { z: zG, width: hallW + 2 });
    const board = boardMesh(w, { x: 0, y: y0 + 6.6, z: zB, width: 12, height: 3.6, header: spec.header || `QUESTION ${k + 1}`, text: q.q, hang: H, headerColor: spec.flip ? '#ff5a6a' : '#d8a94a' });
    const st = {
      k, stage: s.i, spec, q, pads, gate, board, isl, zS, zN, zc, y0, padZ, gateZ: zG, zB, at, stones, decor, decorBodies,
      reached: false, passed: false, unlocked: !spec.locked, lieLetter: null, claim: null,
      timer: null, mind: null, sw: null, origQ: q, origAnswers: answers.map((a) => ({ ...a })), hints: 0,
    };
    st.right = () => st.pads.filter((p) => p.correct);
    st.wrong = () => st.pads.filter((p) => !p.correct);
    if (spec.claim === 'lie' || spec.lie) { const wp = st.wrong().filter((p) => !p.pass); st.lieLetter = spec.lieLetter || wp[Math.floor(Math.random() * wp.length)].letter; st.claim = st.lieLetter; }
    else if (spec.claim === 'right') st.claim = st.right()[0].letter;
    else if (typeof spec.claim === 'string') st.claim = spec.claim;
    if (spec.poll) { const wp = st.wrong().filter((p) => !p.pass); st.pollLetter = wp[Math.floor(Math.random() * wp.length)].letter; st.poll = pollBoard(st); }
    const tlim = spec.timer || (spec.switch ? 8 : 0);
    if (tlim) {
      const clock = clockMesh(w, 8.6, y0 + 6.6, zB, { hang: H });
      st.timer = { limit: tlim, left: tlim, started: !!spec.switch && false, clock, downT: 0, on: !!spec.timer };
    }
    st.unlock = () => { st.unlocked = true; reveal(); };
    node.round = st;
    rounds.push(st); s.rounds.push(st);
    // a quiet save when you step onto the island, and the host's opening line for the round
    w.trigger({ x: 0, y: y0 + 1.5, z: zc, w: hallW - 1, h: 3, d: islandD - 0.6, once: false, onEnter: () => {
      if (game.state !== 'playing') return;
      w.respawn = { x: at.x, y: at.y, z: at.z, yaw: 0 };
      if (!st.reached) { st.reached = true; if (k === cleared) enterRound(st); }
    } });
    show.z = zN - 9.0 - extra;
    return st;
  };

  function piston(plat, len) {
    if (len < 0.3) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, len, 8), plainMaterial(GOLD, { metalness: 1, roughness: 0.35 }));
    m.position.set(0, -0.3 - len / 2, 0); m.castShadow = false;
    plat.group.add(m);
  }
  function seams(pads, y, z) {   // glowing lines where two pads meet (double or nothing)
    for (let i = 0; i + 1 < pads.length; i++) {
      const a = pads[i].plat.body, x = a.x + a.hx;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, a.hz * 2 - 0.2), glowMaterial(0xffe08a, 2.2));
      m.position.set(x, y + 0.02, z); m.matrixAutoUpdate = false; m.updateMatrix(); w.add(m);
    }
  }
  function pollBoard(st) {   // "ASK THE AUDIENCE": the audience is mostly furniture, and it is wrong
    const c = document.createElement('canvas'); c.width = 512; c.height = 320;
    const g = c.getContext('2d');
    const real = st.pads.filter((p) => !p.pass);
    const pct = real.map((p) => (p.letter === st.pollLetter ? 61 + Math.floor(Math.random() * 20) : 4 + Math.floor(Math.random() * 12)));
    st.pollPct = Object.fromEntries(real.map((p, i) => [p.letter, pct[i]]));
    g.fillStyle = '#0c0810'; g.fillRect(0, 0, 512, 320); g.strokeStyle = '#d8a94a'; g.lineWidth = 8; g.strokeRect(4, 4, 504, 312);
    g.fillStyle = '#d8a94a'; g.font = '34px "Archivo Black", Impact, sans-serif'; g.textAlign = 'center'; g.fillText('ASK THE AUDIENCE', 256, 50);
    const bw = 380 / real.length;
    real.forEach((p, i) => {
      const h = pct[i] * 2.0, x = 66 + i * bw;
      g.fillStyle = p.letter === st.pollLetter ? '#6cf0b2' : '#5a6aa8'; g.fillRect(x + 10, 268 - h, bw - 20, h);
      g.fillStyle = '#fff6e0'; g.font = '30px "Archivo Black", Impact, sans-serif'; g.fillText(p.letter, x + bw / 2, 302); g.font = '22px "Archivo Black", Impact, sans-serif'; g.fillText(pct[i] + '%', x + bw / 2, 258 - h);
    });
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; w.ownTextures.push(tex);
    const grp = new THREE.Group(); grp.position.set(-8.9, st.y0 + 6.6, st.zB);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.25), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); face.position.z = 0.02; grp.add(face);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.55, 0.2), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); back.position.z = -0.12; grp.add(back);
    const len = H - (st.y0 + 6.6 + 1.27);
    for (const sx of [-1, 1]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); rod.position.set(sx * 1.4, 1.27 + len / 2, -0.12); grp.add(rod); }
    w.add(grp);
    return grp;
  }

  // ---------------------------------------------------------------------------------------------------------------
  //  Running
  // ---------------------------------------------------------------------------------------------------------------
  const live = () => rounds[cleared];
  const reveal = () => rounds.forEach((st) => {
    const on = st.k <= cleared && !st.hidden;
    st.board.visible = on;
    if (st.poll) st.poll.visible = on;
    st.pads.forEach((p) => { p.tag.visible = on && st.unlocked; p.posts.forEach((m) => { m.visible = on && st.unlocked; }); });
    if (st.timer && !on) st.timer.clock.show(false);
  });
  show.reveal = reveal;
  const resetPad = (pad) => {
    pad.set('idle'); pad.lockT = 0; pad.dropT = 0; pad.fallY = 0; pad.vy = 0; pad.eliminated = false; pad.falling = false; pad.wobble = 0;
    pad.plat.setEnabled(!pad.off); pad.plat.group.scale.setScalar(1);
  };
  const dropPad = (pad) => { pad.plat.body.enabled = false; pad.falling = true; pad.vy = 0; };
  const resetTimer = (st) => {
    const tm = st.timer; if (!tm) return;
    tm.left = tm.limit; tm.started = false; tm.downT = 0; tm.on = !!st.spec.timer; tm.clock.set(-1); tm.clock.show(!!st.spec.timer && st.k <= cleared && !st.hidden);
  };
  const setQuestion = (st, q, answers) => {
    st.q = q;
    st.board.setText(q.q, st.sw ? 'THE QUESTION HAS CHANGED' : (st.spec.header || `QUESTION ${st.k + 1}`), st.sw ? '#ff5a6a' : (st.spec.flip ? '#ff5a6a' : '#d8a94a'));
    st.pads.forEach((p, i) => { if (p.pass) return; const a = answers[i]; if (!a) return; p.correct = a.correct; p.setText(a.text); });
  };
  const resetRound = (st) => {
    st.pads.forEach(resetPad); resetTimer(st);
    st.mind = null; st.dbl = null;
    if (st.sw) { st.sw = null; setQuestion(st, st.origQ, st.origAnswers); }
  };
  function enterRound(st) {
    const sp = st.spec;
    if (sp.timer && st.timer) { st.timer.started = true; st.timer.clock.show(true); }
    if (sp.say) say(sp.say, { vars: { letter: st.claim || '', text: st.pads.find((p) => p.letter === st.claim)?.text || '', right: st.right()[0]?.letter || '', poll: st.pollLetter || '', pct: st.pollPct?.[st.pollLetter] || '' } });
    sp.onEnter?.(st);
  }
  show.enter = enterRound;

  function clearRound(st, pads) {
    for (const p of pads) p.set('right');
    st.gate.open(); cleared = st.k + 1; reveal();
    if (st.timer) { st.timer.clock.show(false); st.timer.on = false; }
    game.audio.ding(); game.ui.toast('✔ Correct', 'gold');
    const sp = st.spec;
    if (!sp.mind || game.baby) say(sp.sayRight || K('right'), { priority: 2 });
    sp.onClear?.(st);
    show.onClear?.(st);
    // the next round may already be under your feet (never, with this layout) — be safe
    const nx = rounds[cleared];
    if (nx && nx.reached) enterRound(nx);
  }
  function wrongPads(st, pads) {
    for (const p of pads) { p.set('wrong'); p.dropT = 0; }
    game.audio.buzzer();
    const sp = st.spec, lied = st.lieLetter && pads.some((p) => p.letter === st.lieLetter);
    const polled = st.pollLetter && pads.some((p) => p.letter === st.pollLetter);
    say(lied ? (sp.sayLie || K('wrong.lie')) : polled ? (sp.sayPoll || K('wrong')) : (sp.sayWrong || K('wrong')), { priority: 2, vars: { letter: st.claim || st.pollLetter || '' } });
    sp.onWrong?.(st, pads);
  }
  function resolve(st, pad) {
    const sp = st.spec;
    if (sp.switch && !st.sw && !game.baby) { doSwitch(st, pad); return; }
    if (!pad.correct) { wrongPads(st, [pad]); return; }
    if (sp.mind && !game.baby) {   // right... for now
      st.mind = { t: 0, phase: 'check', pad };
      pad.set('right'); st.gate.open(); cleared = st.k + 1; reveal();
      game.audio.ding(); game.ui.toast('✔ Correct', 'gold');
      say(K('mind.check'), { priority: 2 });
      return;
    }
    clearRound(st, [pad]);
  }
  function doSwitch(st, pad) {
    const sw = st.spec.switch;
    st.sw = { t: 0 };
    game.audio.glitch(); game.ui.glitch(true); setTimeout(() => game.ui.glitch(false), 220);
    const ans = st.pads.filter((p) => !p.pass).map((p, i) => ({ text: sw.answers[i]?.text ?? p.text, correct: !!sw.answers[i]?.correct }));
    setQuestion(st, sw, ans);
    st.pads.forEach((p) => { p.set('idle'); p.lockT = 0; });
    void pad;
    if (st.timer) { st.timer.left = st.timer.limit; st.timer.on = true; st.timer.started = true; st.timer.clock.show(true); }
    say(K('switch'), { priority: 2 });
  }

  let modalT = 0;
  w.onUpdate((dt, t) => {
    if (game.frozen) { show.frozenSim += dt; return; }   // fake crashes and loading screens stop the show too (fairly)
    for (const st of rounds) st.gate.update(dt);
    const pl = game.player, playing = game.state === 'playing';
    for (const st of rounds) {
      // a cleared round counts as passed once you stand beyond its gate
      if (st.k < cleared && !st.passed && playing && pl.grounded && pl.z < st.gateZ - 0.5) st.passed = true;
      for (const pad of st.pads) {
        pad.pulse(t);
        if (pad.falling) {
          pad.vy -= 26 * dt; pad.fallY += pad.vy * dt;
          if (pad.fallY < -14) { pad.plat.setEnabled(false); pad.falling = false; }
          continue;
        }
        if (pad.state === 'wrong') {   // a wrong answer wobbles, then drops (in Baby Mode long enough to hop back off)
          pad.dropT += dt;
          pad.plat.group.position.x += (Math.random() - 0.5) * 0.05;
          if (pad.dropT > (game.baby ? 1.5 : 0.35)) dropPad(pad);
        }
      }
      if (st.k !== cleared || st.hidden) { tickMind(st, dt); continue; }
      // ---- answering ----
      if (st.spec.double && !(st.sw)) tickDouble(st, dt, pl, playing);
      else for (const pad of st.pads) {
        if (pad.state !== 'idle' && pad.state !== 'lock') continue;
        const on = playing && pl.grounded && pl.ground === pad.plat.body;
        if (on) {
          if (pad.state === 'idle') { pad.set('lock'); game.audio.tick(); }
          pad.lockT += dt;
          if (pad.lockT >= pad.dwell) resolve(st, pad);
        } else if (pad.state === 'lock') { pad.lockT = 0; pad.set('idle'); }
      }
      // ---- the clock ----
      const tm = st.timer;
      if (tm && tm.on && playing) {
        if (tm.downT > 0) {
          tm.downT -= dt;
          if (tm.downT <= 0) { st.pads.forEach(resetPad); tm.left = tm.limit; tm.downT = 0; tm.started = !!st.spec.switch || st.reached; tm.clock.set(-1); }
        } else if (tm.started) {
          tm.left -= dt * (game.baby ? 0.65 : 1);
          const secs = Math.max(0, Math.ceil(tm.left));
          tm.clock.set(secs, secs <= 4);
          if (secs <= 4 && Math.floor(tm.left * 2) !== tm.beep) { tm.beep = Math.floor(tm.left * 2); game.audio.tick(); }
          if (tm.left <= 0) {
            st.pads.forEach((p) => { if (p.state !== 'gone') { p.set('gone'); dropPad(p); } });
            tm.downT = 3.4; say(st.spec.sayTimeUp || K('timeup'), { priority: 2 });
          }
        }
      }
    }
    // a survey nobody wants to fill in: the bot rates it after a human-ish pause
    if (game.modal?.troll && show.botRates) { modalT += dt; if (modalT > 1.6) { modalT = 0; game.modal.key({ code: 'Digit4' }); } } else modalT = 0;
  });
  function tickMind(st, dt) {
    const m = st.mind; if (!m) return;
    m.t += dt;
    if (m.phase === 'check' && m.t > 1.6) {
      m.phase = 'flip'; m.t = 0;
      m.pad.set('wrong'); m.pad.dropT = -0.9;   // a longer wobble than usual: that is your window
      game.audio.buzzer();
      say(K('mind.flip'), { priority: 2 });
    }
  }
  function overlaps(pl, b) {
    return pl.x + HALF > b.x - b.hx + 0.02 && pl.x - HALF < b.x + b.hx - 0.02 && pl.z + HALF > b.z - b.hz + 0.02 && pl.z - HALF < b.z + b.hz - 0.02 && Math.abs(pl.y - b.top) < 0.06;
  }
  function tickDouble(st, dt, pl, playing) {
    const on = playing && pl.grounded ? st.pads.filter((p) => (p.state === 'idle' || p.state === 'lock') && p.plat.body.enabled && overlaps(pl, p.plat.body)) : [];
    if (on.length === 2) {
      const key = on.map((p) => p.letter).join('');
      if (!st.dbl || st.dbl.key !== key) { st.pads.forEach((p) => { if (p.state === 'lock') p.set('idle'); }); st.dbl = { key, t: 0 }; on.forEach((p) => p.set('lock')); game.audio.tick(); }
      st.dbl.t += dt;
      if (st.dbl.t >= 1.0) {
        st.dbl = null;
        if (on.every((p) => p.correct)) clearRound(st, on);
        else wrongPads(st, on);
      }
    } else {
      if (st.dbl) { st.pads.forEach((p) => { if (p.state === 'lock') p.set('idle'); }); st.dbl = null; }
      if (on.length === 1 && !st.dblTold) { st.dblTold = true; game.ui.toast('DOUBLE OR NOTHING: stand on the line between TWO answers', 'gold'); }
    }
  }

  // ---- respawn: the live round starts over; a round you cleared but never left (the host changed his mind) too ----
  w.onRespawn(() => {
    for (const st of rounds) {
      if (st.k >= cleared) continue;
      if (!st.passed && st.mind) { cleared = Math.min(cleared, st.k); st.gate.close(); st.gate.grp.visible = true; continue; }
      // a cleared round always keeps one standing pad (the right one), so the way on is never gone
      if (!st.pads.some((p) => p.state === 'right' && p.plat.body.enabled)) {
        const rp = st.pads.find((p) => p.state === 'right') || st.pads.find((p) => p.correct);
        if (rp) { resetPad(rp); rp.set('right'); }
      }
      st.mind = null;
    }
    for (let k = cleared; k < rounds.length; k++) resetRound(rounds[k]);
    reveal();
    // the round you are standing in starts over (its clock, its host line)
    const st = live();
    if (st && st.reached && st.timer && st.spec.timer) { st.timer.started = true; st.timer.clock.show(true); }
  });
  reveal();
  rounds.forEach((st) => st.timer && resetTimer(st));

  // ---------------------------------------------------------------------------------------------------------------
  //  Hint: honest. In a round: 50/50 (+ an honest tip on a twist). Between rounds: a trail, never past the next stage.
  // ---------------------------------------------------------------------------------------------------------------
  const curStage = () => {
    let cur = 0, best = Infinity;
    stages.forEach((s, i) => { if (!s.at) return; const d = Math.hypot(s.at.x - w.respawn.x, s.at.z - w.respawn.z) + Math.abs(s.at.y - w.respawn.y) * 0.3; if (d < best) { best = d; cur = i; } });
    return cur;
  };
  show.curStage = curStage;
  show.inRound = () => { const st = live(); return !!(st && st.reached && !st.hidden); };
  w.hintAction = (g) => {
    const st = live();
    if (!show.inRound()) return 'trail';
    if (show.hintGate && !show.hintGate(g, st)) return false;
    const standing = (p) => g.player.grounded && g.player.ground === p.plat.body;
    const cand = st.pads.filter((p) => !p.correct && !p.eliminated && !standing(p) && p.state === 'idle');
    const sp = st.spec;
    const tip = sp.mind ? K('hint.mind') : sp.switch ? K('hint.switch') : sp.double ? K('hint.double') : sp.flip ? K('hint.flip') : sp.pass ? K('hint.pass') : sp.poll ? K('hint.poll') : sp.none ? K('hint.none.above') : null;
    if (!cand.length) { say(tip || K('hint.none'), { priority: 1 }); return !!tip; }
    const pad = cand[Math.floor(Math.random() * cand.length)];
    pad.eliminated = true; pad.set('gone'); dropPad(pad);
    st.hints++;
    say(tip || K('hint'), { priority: 1 });
    return true;
  };
  w.hintFlat = false;
  w.hintFn = (g) => {
    const p = g.player, i = curStage(), s = stages[i];
    const nextAt = stages[i + 1]?.at || (w.goalObj ? { x: w.goalObj.x, y: w.goalObj.y, z: w.goalObj.z } : null);
    // between two rounds: just the next island
    const st = live();
    if (st && !st.reached && st.stage === i && !st.hidden) return [{ x: p.x, y: p.y + 0.15, z: p.z }, { x: 0, y: st.y0 + 0.15, z: st.zc }];
    const route = [...s.route.filter((n) => !rounds.some((r) => r.isl.body === n.body)).map((n) => ({ x: n.body.x, y: n.body.y + n.body.hy, z: n.body.z })), ...(nextAt ? [nextAt] : [])];
    if (!route.length) return null;
    let bi = 0, bd = Infinity;
    route.forEach((q2, j) => { const d = Math.hypot(q2.x - p.x, q2.z - p.z) + Math.abs(q2.y - p.y) * 0.6; if (d < bd) { bd = d; bi = j; } });
    const out = [{ x: p.x, y: p.y + 0.15, z: p.z }];
    for (let j = bi + (bd < 1.2 ? 1 : 0); j < route.length && out.length < 7; j++) out.push({ x: route[j].x, y: route[j].y + 0.15, z: route[j].z });
    return out.length >= 2 ? out : null;
  };

  // ---------------------------------------------------------------------------------------------------------------
  //  The test bot: plays it perfectly (rounds: the right pad; interludes: the stage route, waiting where told to)
  // ---------------------------------------------------------------------------------------------------------------
  show.botRates = false;
  let botIdx = 0, allNodes = null;
  show.nodes = () => (allNodes ||= stages.flatMap((s) => s.route));
  /** Which route node the player is on (a pad counts as its round's island). -1 if none. */
  show.nodeAt = (p) => {
    if (!p.grounded || !p.ground) return -1;
    const all = show.nodes();
    let idx = all.findIndex((n) => n.body === p.ground || (n.alt && n.alt.includes(p.ground)));
    if (idx < 0) { const r = rounds.find((r2) => r2.pads.some((q2) => q2.plat.body === p.ground)); if (r) idx = all.findIndex((n) => n.round === r); }
    return idx;
  };
  show.bot = (g) => {
    const p = g.player, hold = { wait: true, x: p.x, z: p.z };
    if (g.frozen || g.modal) { show.botRates = true; return hold; }
    show.botRates = false;
    const all = show.nodes();
    const here = show.nodeAt(p);
    if (here >= 0) botIdx = here;
    const node = all[botIdx], st = node.round;
    if (st && st.hidden) return hold;
    if (st && st.k >= cleared) {                     // answer it
      if (p.z > st.zS + 0.2 || !st.reached) return { body: st.isl.body };
      if (st.timer && st.timer.downT > 0) return hold;
      if (st.spec.double && !st.sw) {
        const r = st.right(); const a = r[0].plat.body, b = r[1].plat.body; const sx = (a.x + b.x) / 2;
        const onBoth = p.grounded && r.every((q2) => overlaps(p, q2.plat.body));
        if (onBoth && Math.abs(p.x - sx) < 0.25) return hold;
        return { x: sx, z: a.z };
      }
      const right = st.pads.find((q2) => q2.correct && q2.plat.body.enabled && q2.state !== 'wrong');
      if (!right) return hold;
      if (p.grounded && p.ground === right.plat.body) return hold;
      if (st.stones.length) {   // hop the stepping stones in the right answer's column
        const col = st.pads.indexOf(right);
        const r = st.stones.findIndex((row) => p.grounded && row[col] && p.ground === row[col].body);
        if (r < 0 && p.grounded && p.ground === st.isl.body) st.botRow = 0;
        else if (r >= 0) st.botRow = r + 1;
        const nxt = st.stones[st.botRow ?? 0]?.[col];
        if (nxt) return { body: nxt.body };
      }
      return { body: right.plat.body };
    }
    if (node.ride?.(g) && p.grounded && (p.ground === node.body || node.alt?.includes(p.ground))) return hold;
    const nx = all[botIdx + 1];
    if (!nx) return null;
    if (nx.wait?.(g)) return hold;
    return nx.x !== undefined ? { x: nx.x, z: nx.z } : { body: nx.body };
  };

  /** Hide a round completely (for a stage that only appears later, e.g. after a fake LEVEL COMPLETE), or bring it back. */
  show.setHidden = (st, on) => {
    st.hidden = on;
    st.isl.setEnabled(!on);
    st.pads.forEach((p) => { p.off = on; p.plat.setEnabled(!on); });
    st.decor.forEach((m) => { m.visible = !on; });
    st.decorBodies.forEach((b) => { b.enabled = !on; });
    st.gate.grp.visible = !on;
    st.stones.flat().forEach((s2) => s2.setEnabled(!on));
    const s = stages[st.stage];
    if (s.rounds[0] === st && s.cp) s.cp.group.visible = !on;
    reveal();
  };
  show.live = live;
  show.get = () => cleared;
  Object.defineProperty(show, 'cleared', { get: () => cleared, set: (v) => { cleared = v; reveal(); } });
  show.resetRound = resetRound;
  show.overlaps = overlaps;
  return show;
}

/** A pile of suitcases on a platform (scenery that travels with it if `plat` is given). */
export function suitcases(w, x, y, z, { plat = null, n = 3, seed = 1 } = {}) {
  const cols = [0x6a3a22, 0x1a2a4a, 0x4a1a22, 0x2f4a2a, 0x8a6a2a];
  let s = seed * 9301 + 7;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  let yy = y;
  for (let i = 0; i < n; i++) {
    const sw = 0.6 + rnd() * 0.3, sh = 0.3 + rnd() * 0.15, sd = 0.45 + rnd() * 0.2;
    const m = w.box({ x: x + (rnd() - 0.5) * 0.2, y: yy + sh / 2, z: z + (rnd() - 0.5) * 0.2, w: sw, h: sh, d: sd, color: cols[Math.floor(rnd() * cols.length)], rough: 0.5, static: !plat, rot: (rnd() - 0.5) * 0.5 });
    const strap = w.box({ x: m.position.x, y: yy + sh / 2, z: m.position.z, w: 0.06, h: sh + 0.02, d: sd + 0.02, color: GOLD, metal: 1, rough: 0.3, static: !plat, rot: m.rotation.y, shadow: false });
    if (plat) { plat.attach(m); plat.attach(strap); }
    yy += sh;
  }
}
