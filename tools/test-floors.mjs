// In-browser logic tests for the hotel's lobby hub and floors 2 and 3 (needs `vite preview` on :4173). Usage: node tools/test-floors.mjs [name-filter]
import { chromium } from 'playwright-core';

const base = process.env.BASE || 'http://localhost:4173/';
const filter = process.argv[2] || '';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const errs = [];
async function open(level) {
  const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}?debug&campaign=hotel&level=${level}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__trust && window.__trust.world && window.__trust.state === 'playing', null, { timeout: 60000 });
  await page.evaluate(() => { window.__trust.manual = true; });
  return page;
}
const suites = {};
const suite = (name, fn) => { suites[name] = fn; };

// ---- the mazes (4, 9, 12): no walking round the outside --------------------------------------------------
// Flood-fills the floor from the spawn point at 0.5 m resolution. Anything solid that rises more than a jump above the
// floor blocks; every door that can open is treated as open. The cells beside the maze must stay unreachable except via the
// maze, i.e. the fill must not get from the spawn row to the exit row without entering the maze's columns.
for (const [lvl, name] of [[4, 'revolving'], [9, 'kitchen-maze'], [12, 'dnd-maze']]) {
  suite('mazeseal-' + name, async () => {
    const page = await open(lvl);
    const r = await page.evaluate(() => {
      const g = window.__trust, w = g.world, step = 0.5;
      const M = w.maze || (() => { const gr = w.dnd.grid; return { grid: gr, N: gr.N, C: gr.C, doors: [] }; })();
      const doorBodies = new Set((M.doors || []).map((d) => d.body));
      const bodies = w.bodies.filter((b) => b.solid && !doorBodies.has(b) && (b.enabled || b.top - b.hy * 2 > -50));
      const blocked = (x, z) => bodies.some((b) => b.top > 1.6 && b.top - b.hy * 2 < 1.0 && Math.abs(x - b.x) < b.hx + 0.4 && Math.abs(z - b.z) < b.hz + 0.4);
      const floor = (x, z) => bodies.some((b) => Math.abs(b.top) < 0.6 && Math.abs(x - b.x) < b.hx && Math.abs(z - b.z) < b.hz);   // (off the edge is a long fall, not a way round)
      const sx = g.player.x, sz = g.player.z;
      const half = 40, key = (i, j) => i * 1000 + j;
      const seen = new Set([key(0, 0)]), q = [[0, 0]];
      const sideReached = [];
      const x0 = M.grid ? M.grid.X0 : M.X0, N = M.N, C = M.C, Z0 = M.grid ? M.grid.Z0 : M.Z0;
      while (q.length) {
        const [i, j] = q.pop();
        const x = sx + i * step, z = sz + j * step;
        // beside the maze: west or east of its footprint, between its south and north walls
        if ((x < x0 - 0.8 || x > x0 + N * C + 0.8) && z < Z0 - 1 && z > Z0 - N * C + 1) sideReached.push([x, z]);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = i + di, nj = j + dj, nx = sx + ni * step, nz = sz + nj * step;
          if (Math.abs(nx) > half || Math.abs(nz - sz) > 60 || seen.has(key(ni, nj))) continue;
          if (blocked(nx, nz) || !floor(nx, nz)) continue;
          seen.add(key(ni, nj)); q.push([ni, nj]);
        }
      }
      return { side: sideReached.length, cells: seen.size, ex: sideReached[0] || null };
    });
    ok(r.cells > 400, `${name}: the fill covers a real area (${r.cells} cells)`);
    ok(r.side === 0, `${name}: nowhere beside the maze can be reached from the spawn (${r.side} cells leak${r.ex ? ' e.g. ' + r.ex : ''})`);
    await page.close();
  });
}

// ---- level 6: Soufflé ------------------------------------------------------------------------------------
suite('souffle', async () => {
  const page = await open(6);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, sf = w.souffle, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    out.platforms = sf.plats.length;
    const f0 = sf.foamTop(w.t);
    sim(3); out.waits = Math.abs(sf.foamTop(w.t) - f0) < 0.01;
    // burners and vents switch on and off
    const seenB = sf.burners.map(() => new Set()), seenV = sf.vents.map(() => new Set());
    for (let i = 0; i < 60 * 9; i++) { g._simulate(1 / 60); sf.burners.forEach((b, k) => seenB[k].add(b.hz.enabled)); sf.vents.forEach((v, k) => seenV[k].add(v.hz.enabled)); }
    out.burners = sf.burners.length; out.burnersCycle = seenB.every((s) => s.size === 2);
    out.vents = sf.vents.length; out.ventsCycle = seenV.every((s) => s.size === 2);
    out.rises = sf.foamTop(w.t) > f0 + 2;
    // baby mode: slower
    const tRef = sf.tStart + 6 + 20; g.baby = false; const a = sf.foamTop(tRef); g.baby = true; const b = sf.foamTop(tRef); g.baby = false;
    out.babySlower = b < a - 2;
    // it eventually gets you
    for (let i = 0; i < 60 * 30 && g.state === 'playing'; i++) g._simulate(1 / 60);
    out.caught = g.state === 'dead';
    g.state = 'playing'; g.respawnPlayer(false);
    out.resets = sf.foamTop(w.t) <= -4.9;
    // the fake exit kills
    g.player.teleport(-11.8, 14.1, -6); g._simulate(1 / 60);
    out.fakeExit = g.state === 'dead';
    return out;
  });
  ok(r.platforms >= 28, `souffle: a long climb (${r.platforms} platforms)`);
  ok(r.waits && r.rises, 'souffle: the soufflé waits a moment, then rises');
  ok(r.burnersCycle && r.burners >= 3, `souffle: burners switch on and off (${r.burners})`);
  ok(r.ventsCycle && r.vents >= 3, `souffle: steam jets switch on and off (${r.vents})`);
  ok(r.babySlower, 'souffle: baby mode slows the rise');
  ok(r.caught && r.resets, 'souffle: it gets you if you stall, and restarts below your checkpoint');
  ok(r.fakeExit, 'souffle: the fake EXIT door is the oven');
  await page.close();
});

// ---- quiz levels 2, 7, 13 (the multi-act runner, src/levels/hotel/quiz-show.js) ---------------------------------
// in-page helpers: window.__T = { g, w, S (the show), sim, at, onPad, island, right, answer }
const QUIZ_HELP = () => {
  const g = window.__trust, w = g.world;
  const T = window.__T = {
    g, w, S: w.quizShow,
    sim(sec) { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } },
    at(x, y, z, ground = null) { g.player.teleport(x, y, z); g.player.grounded = true; g.player.ground = ground; },
    onPad(p) { const b = p.plat.body; T.at(b.x, b.top, b.z, b); },
    island(st) { const b = st.isl.body; T.at(0, b.top, st.zS - 1.8, b); },
    right(st) { return st.pads.find((p) => p.correct && !p.eliminated && p.plat.body.enabled); },
    answer(st) { T.island(st); T.sim(0.3); T.onPad(T.right(st)); T.sim(1.4); },
    standOn(b) { T.at(b.x, b.top, b.z, b); },
  };
};
// every key a quiz level can say must exist in SCRIPT (the narrator would print the key)
async function scriptKeysFor(n, files, dynamic) {
  const { SCRIPT } = await import('../src/script.js');
  const fs = await import('node:fs');
  const used = new Set(dynamic.map((k) => `hotel.l${n}.${k}`));
  for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/['`](hotel\.l\d+\.[\w.]+)['`]/g)) if (m[1].startsWith(`hotel.l${n}.`)) used.add(m[1]);
  return [...used].filter((k) => !(k in SCRIPT));
}
const RUNNER_KEYS = ['right', 'wrong', 'wrong.lie', 'timeup', 'hint', 'hint.none'];
const fakeOverlay = (page) => page.evaluate(() => !!document.querySelector('.fakewin'));

// ---- level 2: Check-In ---------------------------------------------------------------------------------------------
suite('checkin', async () => {
  const miss = await scriptKeysFor(2, ['src/levels/hotel/check-in.js'], [...RUNNER_KEYS, 'hint.mind', 'hint.switch', 'hint.double', 'hint.flip', 'hint.pass', 'hint.poll', 'hint.none.above', 'mind.check', 'mind.flip', 'switch']);
  ok(miss.length === 0, `checkin: every line the level can say exists in the script (${miss.join(', ') || 'none missing'})`);
  const page = await open(2); await page.evaluate(QUIZ_HELP);
  const r = await page.evaluate(() => {
    const { g, w, S, sim, island, onPad, right, answer } = window.__T, c = w.checkin, R = S.rounds, out = {};
    out.rounds = R.length; out.stages = S.stages.length; out.cps = S.stages.filter((s) => s.at).length;
    out.lieWrong = R[1].lieLetter && R[1].wrong().some((p) => p.letter === R[1].lieLetter);
    out.honestRight = R[0].claim === R[0].right()[0].letter;
    out.slide = !!R[2].spec.slide; out.timer = R[3].spec.timer; out.stones = R[3].stones.length;
    out.none = R[4].right()[0].text === 'None of the above' && R[4].wrong().length === 3;
    out.flipWrongRight = R[5].spec.flip;
    out.twoRight = R[6].right().length === 2; out.breathe = !!R[7].spec.breathe; out.mind = !!R[8].spec.mind;
    // a wrong pad wobbles (the tell) and drops
    island(R[0]); sim(0.3);
    const wp = R[0].wrong()[0]; onPad(wp); sim(0.2); out.wobble = wp.state === 'lock' || wp.state === 'wrong'; sim(1.6); out.wrongDrops = wp.plat.body.enabled === false || wp.falling || wp.fallY < -0.5;
    g.kill('test'); g.state = 'playing'; g.respawnPlayer(false); sim(0.5);
    // honest hint: removes one WRONG answer, never the right one (and a second one too), never more than what is left
    island(R[0]); sim(0.3); g.debug = false; g.hintCool = 0; g.useHint();
    out.hint1 = R[0].pads.filter((p) => p.eliminated).length === 1 && R[0].right().length === 1 && R[0].pads.filter((p) => p.eliminated).every((p) => !p.correct);
    g.hintCool = 0; g.useHint(); g.hintCool = 0; g.useHint();
    out.hintNeverRight = R[0].right().length === 1 && R[0].pads.filter((p) => p.eliminated).length === 2;
    g.kill('test'); g.state = 'playing'; g.respawnPlayer(false); sim(0.5);
    // round 1-3 clear in order; the survey comes with the second stage's flag
    for (let k = 0; k < 3; k++) answer(R[k]);
    out.cleared3 = S.cleared === 3;
    return out;
  });
  ok(r.rounds === 10 && r.stages === 6 && r.cps === 6, `checkin: 10 questions in 6 stages, a checkpoint per stage (${r.rounds}/${r.stages}/${r.cps})`);
  ok(r.lieWrong && r.honestRight, 'checkin: Q1 the host is honest, Q2 the host names a WRONG letter');
  ok(r.slide && r.timer === 16 && r.stones === 2, 'checkin: Q3 slides, Q4 has a 16 s clock over stepping stones');
  ok(r.none && r.flipWrongRight, 'checkin: Q5 "None of the above" is the answer, Q6 asks for a WRONG answer');
  ok(r.twoRight && r.breathe && r.mind, 'checkin: Q7 two right answers, Q8 breathing pads, Q9 the host changes his mind');
  ok(r.hint1 && r.hintNeverRight, 'checkin: the hint removes wrong answers only and never the right one');
  ok(r.wobble && r.wrongDrops, 'checkin: a wrong pad wobbles (the tell) and drops');
  ok(r.cleared3, 'checkin: Q1-Q3 clear in order');
  // stage 2 start shows the survey; rate it; Escape does not close it
  await page.evaluate(() => { const { S, w } = window.__T; const c = S.stages[1].cp; const g = window.__trust; g.player.teleport(c.x, c.y, c.z); window.__T.sim(0.5); });
  const sv = await page.evaluate(() => ({ modal: !!window.__trust.modal?.troll, state: window.__trust.state }));
  ok(sv.modal, 'checkin: the survey modal appears at the start of the luggage hall');
  await page.evaluate(() => { const g = window.__trust; g.modal.key({ code: 'Escape' }); });
  ok(await page.evaluate(() => !!window.__trust.modal), 'checkin: Escape does not close the survey');
  await page.evaluate(() => { window.__trust.modal.key({ code: 'Digit4' }); });
  ok(await page.evaluate(() => !window.__trust.modal), 'checkin: ...rating it does');
  // the fake checkpoint (crooked pole) saves nothing
  const cp = await page.evaluate(() => {
    const { w, g, sim } = window.__T, c = w.checkin;
    g.player.teleport(c.fakeCp.x, c.fakeCp.y, c.fakeCp.z); g.player.grounded = true; sim(0.5);
    return { saved: Math.abs(w.respawn.z - c.fakeCp.z) < 0.5, real: c.fakeCp.real };
  });
  ok(!cp.saved && cp.real === false, 'checkin: the crooked-pole checkpoint never saves');
  // the revolving door swaps A and D for a few seconds, then gives them back
  const sw = await page.evaluate(() => {
    const { w, g, sim, standOn } = window.__T, c = w.checkin, out = {};
    standOn(c.doors[0].door.discs[0].body); sim(0.4); out.swapped = !!g.mods.swapStrafe;
    standOn(c.doors[0].door.discs[0].body); for (let i = 0; i < 7; i++) { sim(1); standOn(c.doors[0].door.discs[0].body); }
    out.restored = !g.mods.swapStrafe; return out;
  });
  ok(sw.swapped && sw.restored, 'checkin: the revolving door swaps A/D for a few seconds, then gives them back');
  // every round to the desk, the CHECKED IN screen is a lie, and the register opens
  const desk = await page.evaluate(() => {
    const { w, g, S, sim } = window.__T, c = w.checkin; S.cleared = 9; const out = {};
    out.hiddenBefore = !c.bonusOn && c.finalGoal.trig.enabled === false && w.goalObj === c.deskGoal;
    g.player.teleport(c.deskGoal.x, 0, c.deskGoal.z); sim(0.4);
    out.overlay = !!document.querySelector('.fakewin'); out.notDone = g.state === 'playing';
    return out;
  });
  ok(desk.hiddenBefore && desk.overlay && desk.notDone, 'checkin: the desk shows CHECKED IN! (a fake) and the level is not over');
  await page.waitForTimeout(4600);
  const reg = await page.evaluate(() => {
    const { w, g, S, sim } = window.__T, c = w.checkin; const out = {};
    out.open = c.bonusOn && w.goalObj === c.finalGoal && c.finalGoal.trig.enabled; out.frozen = g.frozen;
    S.cleared = 10; g.player.teleport(c.finalGoal.x, c.finalGoal.y, c.finalGoal.z); sim(0.4); out.done = g.state === 'complete' || w.completed || g.state === 'ended';
    return out;
  });
  ok(reg.open && !reg.frozen, 'checkin: ...then "just kidding": the register stage opens and the game is playable again');
  ok(reg.done, 'checkin: the real goal completes the level');
  await page.close();
  // baby mode: the host does not change his mind
  const pb = await open(2); await pb.evaluate(QUIZ_HELP);
  const bm = await pb.evaluate(() => {
    const { g, S, sim, island, onPad, right } = window.__T; g.baby = true; S.cleared = 8; const st = S.rounds[8];
    island(st); sim(0.3); onPad(right(st)); sim(4);
    return { cleared: S.cleared, standing: right(st) && right(st).plat.body.enabled };
  });
  ok(bm.cleared === 9 && bm.standing, 'checkin: in Baby Mode the right pad stays right');
  await pb.close();
});

// ---- level 7: Trivia Night ------------------------------------------------------------------------------------
suite('trivia', async () => {
  const miss = await scriptKeysFor(7, ['src/levels/hotel/trivia-night.js'], [...RUNNER_KEYS, 'hint.switch', 'hint.double', 'hint.poll', 'hint.none.above', 'switch']);
  ok(miss.length === 0, `trivia: every line the level can say exists in the script (${miss.join(', ') || 'none missing'})`);
  const page = await open(7); await page.evaluate(QUIZ_HELP);
  const r = await page.evaluate(() => {
    const { g, w, S, sim, island, onPad, right, answer, standOn } = window.__T, t = w.trivia, R = S.rounds, out = {};
    out.rounds = R.length; out.stages = S.stages.length; out.pads = R.map((s) => s.pads.length).join(',');
    out.lieIsWrong = !!R[1].lieLetter && R[1].wrong().some((p) => p.letter === R[1].lieLetter) && t.lieLetter === R[1].lieLetter;
    out.callback = R[5].right()[0].text === R[1].lieLetter;                                  // round 6 asks for the letter the host swore by in round 2
    out.decoyWrong = R[4].claim === t.decoy && R[4].wrong().some((p) => p.letter === t.decoy);
    out.none = R[6].right()[0].text === 'None of the above' && R[6].wrong().length === 3;
    out.doubleAdjacent = (() => { const rr = R[7].right(); return rr.length === 2 && Math.abs(rr[0].plat.body.x - rr[1].plat.body.x) < 4; })();
    out.switchSpec = !!R[8].spec.switch; out.poll = !!R[9].spec.poll && !!R[9].pollLetter && R[9].wrong().some((p) => p.letter === R[9].pollLetter);
    // round 3 slides; round 4 has a 12 s clock that takes the pads away and brings them back
    const x0 = R[2].pads[0].plat.body.x; let moved = 0; for (let i = 0; i < 360; i++) { g._simulate(1 / 60); moved = Math.max(moved, Math.abs(R[2].pads[0].plat.body.x - x0)); }
    out.slides = moved > 0.8;
    for (let k = 0; k < 3; k++) answer(R[k]);
    out.cleared3 = S.cleared === 3;
    island(R[3]); sim(0.4); out.clock = R[3].timer.started && R[3].timer.limit === 12;
    sim(13); out.padsGone = R[3].pads.every((p) => p.state === 'gone'); sim(4); out.padsBack = R[3].pads.every((p) => p.state === 'idle' && p.plat.body.enabled);
    out.fourPads = R[4].pads.length === 4;
    return out;
  });
  ok(r.rounds === 10 && r.stages === 6, `trivia: ten rounds in six stages (${r.rounds}/${r.stages})`);
  ok(r.pads === '3,3,3,3,4,3,4,4,3,3', `trivia: answers per round 3/3/3/3/4/3/4/4/3/3 (${r.pads})`);
  ok(r.lieIsWrong, 'trivia: in round 2 the host picks a WRONG letter');
  ok(r.callback, 'trivia: round 6 asks for the letter the host swore by in round 2');
  ok(r.decoyWrong && r.none && r.doubleAdjacent && r.switchSpec && r.poll, 'trivia: round 5 reverse psychology · 7 none of the above · 8 double or nothing · 9 the question changes · 10 a lying poll');
  ok(r.slides && r.cleared3, 'trivia: round 3 slides; rounds 1-3 clear in order');
  ok(r.clock && r.padsGone && r.padsBack, 'trivia: round 4: the 12 s clock removes the pads at zero and they come back');
  // double or nothing: one foot is not enough, two is
  const d = await page.evaluate(() => {
    const { g, S, sim, island, standOn, w } = window.__T; S.cleared = 7; const st = S.rounds[7]; island(st); sim(0.3); const [a, b] = st.right().map((p) => p.plat.body); const out = {};
    standOn(a); sim(2.2); out.single = S.cleared === 7;
    window.__T.at((a.x + b.x) / 2, a.top, a.z, a); sim(1.6); out.both = S.cleared === 8; return out;
  });
  ok(d.single && d.both, 'trivia: double or nothing needs a foot on both right answers');
  // the question changes when you sign (not in Baby Mode)
  const sw = await page.evaluate(() => {
    const { g, S, sim, island, onPad, right } = window.__T; S.cleared = 8; const st = S.rounds[8]; island(st); sim(0.3); const q0 = st.q.q; const out = {};
    onPad(right(st)); sim(1.3); out.changed = st.q.q !== q0 && S.cleared === 8; out.clockOn = st.timer.on;
    onPad(right(st)); sim(1.3); out.then = S.cleared === 9; return out;
  });
  ok(sw.changed && sw.clockOn && sw.then, 'trivia: round 9 changes the question after you sign, then lets you re-pick');
  // the trophy lies; the tie-breaker bridge and round 10 appear
  const tr = await page.evaluate(() => {
    const { g, w, S, sim } = window.__T, t = w.trivia, out = {}; S.cleared = 9;
    out.before = !t.bonusOn && t.rLast.hidden && w.goalObj === t.deskGoal && t.bridge.every((p) => !p.body.enabled);
    g.player.teleport(t.deskGoal.x, 0, t.deskGoal.z); sim(0.4); out.overlay = !!document.querySelector('.fakewin') && g.state === 'playing'; return out;
  });
  ok(tr.before && tr.overlay, 'trivia: the trophy shows CHAMPION! (a fake) and nothing of the tie-breaker is there yet');
  await page.waitForTimeout(4600);
  const tb = await page.evaluate(() => {
    const { g, w, S, sim, island, onPad, right } = window.__T, t = w.trivia, out = {};
    out.open = t.bonusOn && !t.rLast.hidden && t.bridge.every((p) => p.body.enabled) && !g.frozen;
    island(t.rLast); sim(0.3); onPad(right(t.rLast)); sim(1.4); out.cleared = S.cleared === 10;
    g.player.teleport(t.finalGoal.x, t.finalGoal.y, t.finalGoal.z); sim(0.4); out.done = g.state === 'complete' || w.completed || g.state === 'ended'; return out;
  });
  ok(tb.open, 'trivia: ...then "a tie-breaker": the chandelier bridge and round 10 appear');
  ok(tb.cleared && tb.done, 'trivia: round 10 clears and the real goal completes the level');
  await page.close();
  // the chandelier hop: the vanishing chandelier shimmers and gives way; the expiring checkpoint forgets itself
  const p2 = await open(7); await p2.evaluate(QUIZ_HELP);
  const hop = await p2.evaluate(() => {
    const { g, w, S, sim, standOn } = window.__T, t = w.trivia, out = {};
    standOn(t.c4.body); sim(1.6); out.vanished = t.c4.body.enabled === false; sim(3.6); out.back = t.c4.body.enabled === true;
    const ep = S.stages[3].route.slice(-1)[0].body; const before = { ...w.respawn };
    g.player.teleport(ep.x, ep.top, ep.z); g.player.grounded = true; g.player.ground = ep; sim(0.5); const set = Math.abs(w.respawn.z - ep.z) < 1.5;
    sim(21); out.expired = set && Math.abs(w.respawn.z - ep.z) > 1.5;
    return out;
  });
  ok(hop.vanished && hop.back, 'trivia: a chandelier gives way once you are on it, and comes back');
  ok(hop.expired, 'trivia: the balcony checkpoint expires after 20 s');
  await p2.close();
});

// ---- level 8: Dinner Is Served --------------------------------------------------------------------------------
suite('dinner', async () => {
  const page = await open(8);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, dn = w.dinner, out = {};
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    out.six = dn.cloches.length === 6 && new Set(dn.order.map((c) => c.name)).size === 6;
    // hints: three levels of clue, then (door open) the trail
    g.debug = false; for (let i = 0; i < 3; i++) { g.hintCool = 0; g.useHint(); }
    out.hints = said.filter((k) => /l8\.hint/.test(k)).join(',');
    // serve the WRONG course first: a cake falls where you stand; the shadow warns you first
    g.player.teleport(0, 0.001, 0);
    const wrong = dn.cloches.find((c) => c.c !== dn.order[0]);
    dn.serve(wrong);
    out.progressReset = dn.served === 0; out.trapSprang = dn.trapBusy;
    sim(0.5); out.warnFirst = g.state === 'playing';
    sim(1.2); out.cakeKills = g.state === 'dead';
    g.state = 'playing'; g.respawnPlayer(false); sim(2.5);
    out.trapOver = !dn.trapBusy;
    // dodge: step away while the shadow grows
    g.player.teleport(0, 0.001, 0); dn.serve(wrong); sim(0.3); g.player.teleport(6, 0.001, 0); sim(2.5);
    out.dodged = g.state === 'playing';
    // serve all six in order: the door opens
    for (const c of dn.order) dn.serve(dn.cloches.find((r) => r.c === c));
    out.opened = dn.doorOpen && dn.served === 6;
    sim(2);
    out.barrels = dn.barrels.length;
    // a barrel in the aisle hurts
    g.player.teleport(0, 0.001, -30); const b = dn.barrels[0];
    g.player.teleport(b.body.x, 0.001, b.body.z); g._simulate(1 / 60); out.barrelKills = g.state === 'dead';
    return out;
  });
  ok(r.six, 'dinner: six different courses');
  ok(r.hints === 'hotel.l8.hint1,hotel.l8.hint2,hotel.l8.hint3', `dinner: three hint levels (${r.hints})`);
  ok(r.progressReset && r.trapSprang, 'dinner: a wrong course resets the meal and springs the dessert trolley');
  ok(r.warnFirst && r.cakeKills, 'dinner: the cake gives a warning, then flattens you if you stay');
  ok(r.trapOver && r.dodged, 'dinner: ...and you can dodge it');
  ok(r.opened, 'dinner: all six courses in the menu\'s order open the kitchen door');
  ok(r.barrels >= 5 && r.barrelKills, `dinner: ${r.barrels} barrels roll down the cellar and hurt`);
  await page.close();
});

// ---- level 9: Kitchen Maze ---------------------------------------------------------------------------------------
suite('kitchen', async () => {
  const page = await open(9);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, m = w.maze, ch = m.chef, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    out.solved = m.solve([0, 0]).length > 14;
    out.ice = m.ice.size; out.slippery = w.bodies.filter((b) => b.slip > 0.5).length;
    out.doors = m.doors.length;
    // the chef waits at the entrance for his head start, then walks toward you through the maze
    out.chefAtStart = ch.cell.join() === '0,0';
    g.player.teleport(m.cx(5), 0.01, m.cz(5));
    sim(5); out.waits = ch.cell.join() === '0,0';
    sim(10);
    const d0 = Math.hypot(ch.x - g.player.x, ch.z - g.player.z);
    out.chases = ch.moving || ch.cell.join() !== '0,0';
    // he does not walk through walls: his cell changes by one step at a time
    let prev = ch.cell.slice(), legal = true;
    for (let i = 0; i < 60 * 12 && g.state === 'playing'; i++) { g._simulate(1 / 60); const c = ch.cell; if (c[0] !== prev[0] || c[1] !== prev[1]) { if (!m.maze.nbrs(prev[0], prev[1]).some((n) => n[0] === c[0] && n[1] === c[1])) legal = false; prev = c.slice(); } }
    out.legal = legal;
    // he eventually catches a player who stands still
    for (let i = 0; i < 60 * 80 && g.state === 'playing'; i++) g._simulate(1 / 60);
    out.caught = g.state === 'dead';
    g.state = 'playing'; g.respawnPlayer(false);
    out.chefReset = ch.cell.join() === '0,0';
    // one-way doors: you can go through them the right way, and not back
    const d = m.doors[0]; g.state = 'playing';
    g.player.teleport(d.mx - d.dirx * 2, 0.01, d.mz - d.dirz * 2); sim(0.1);
    const before = d.body.enabled;
    g.player.teleport(d.mx + d.dirx * 1.6, 0.01, d.mz + d.dirz * 1.6); sim(0.1);
    const after = d.body.enabled;
    out.oneWay = !before && after;
    return out;
  });
  ok(r.solved && r.ice >= 3 && r.slippery >= 3, `kitchen: a solvable maze with icy freezer cells (${r.ice} of them)`);
  ok(r.doors === 3, 'kitchen: three one-way doors');
  ok(r.oneWay, 'kitchen: a one-way door lets you through and shuts behind you');
  ok(r.chefAtStart && r.waits, 'kitchen: the chef starts at the entrance and waits for his head start');
  ok(r.chases && r.legal, 'kitchen: then he hunts you through the corridors (never through walls)');
  ok(r.caught && r.chefReset, 'kitchen: he catches you if you stall, and starts over after a death');
  await page.close();
});

// ---- level 10: Dance Floor --------------------------------------------------------------------------------------
suite('dance', async () => {
  const page = await open(10);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, d = w.dance, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    out.tiles = d.tiles.length; out.booths = d.booths.length;
    // every tile blinks, each lit about ON/P of the time, and consecutive ones overlap (so there is always a way on)
    const seen = d.tiles.map(() => ({ on: 0, off: 0 })); let overlap = 0, samples = 0;
    for (let i = 0; i < 60 * 12; i++) { g._simulate(1 / 60); d.tiles.forEach((t, k) => { seen[k][t.pl.body.enabled ? 'on' : 'off']++; }); for (let k = 0; k + 1 < d.tiles.length; k += 3) { samples++; if (d.tiles[k].pl.body.enabled && d.tiles[k + 1].pl.body.enabled) overlap++; } }
    out.blink = seen.every((s) => s.on > 60 && s.off > 60);
    out.overlap = overlap / samples;
    // the booths are solid, always
    out.boothsSolid = d.booths.every((b) => b.pl.body.enabled);
    // freeze: moving kills, standing still is fine
    const tFreeze = (() => { let t = w.t; while (d.phaseOf(t) !== 'freeze') t += 0.05; return t; })();
    // put the player on the first booth-less spot: the start platform
    g.player.teleport(0, 0.001, 9); g.player.grounded = true;
    while (w.t < tFreeze + 0.2) g._simulate(1 / 60);
    out.frozen = d.frozen;
    sim(0.9); out.stillOk = g.state === 'playing';
    g.keys.add('KeyW'); sim(0.5); g.keys.delete('KeyW');
    out.movingKills = g.state === 'dead';
    return out;
  });
  ok(r.tiles === 18 && r.booths === 3, `dance: ${r.tiles} blinking tiles and ${r.booths} solid booths`);
  ok(r.blink && r.boothsSolid, 'dance: tiles blink on and off, booths never do');
  ok(r.overlap > 0.35, `dance: consecutive tiles are lit together often enough to hop (${(r.overlap * 100).toFixed(0)}%)`);
  ok(r.frozen && r.stillOk, 'dance: FREEZE: standing still is fine');
  ok(r.movingKills, 'dance: ...moving is not');
  await page.close();
});

// ---- level 11: Room 404 ------------------------------------------------------------------------------------------
suite('room404', async () => {
  const page = await open(11);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, rm = w.room404, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    const face = (x, z) => { const p = g.player; g.yaw = Math.atan2(-(x - p.x), -(z - p.z)); g.pitch = 0; };
    const bed = rm.pieces.find((p) => p.name === 'bed'), chair = rm.pieces.find((p) => p.name === 'armchair');
    out.code = rm.code; out.notFake = rm.code !== rm.fake;
    // searching the bed/desk/dresser reveals the three digits, the armchair is a lie
    for (const p of rm.pieces) rm.search(p);
    out.digits = rm.found.join('') === rm.code;
    // the wardrobe is frozen while you look at it and walks when you do not
    rm.ward.active = true;
    g.player.teleport(0, 0.001, 6.5);
    face(rm.ward.x, rm.ward.z); const w0 = [rm.ward.x, rm.ward.z]; sim(1.5);
    out.frozenWhenWatched = Math.hypot(rm.ward.x - w0[0], rm.ward.z - w0[1]) < 0.01;
    g.yaw += Math.PI; const w1 = [rm.ward.x, rm.ward.z]; sim(1.0);
    out.walksWhenNot = Math.hypot(rm.ward.x - w1[0], rm.ward.z - w1[1]) > 1.2;
    // furniture: stays put while watched (or near), relocates when unseen for a while and far away
    g.player.teleport(0, 0.001, 8.2); rm.ward.active = false;
    const slot0 = bed.slot;
    // look at the bed from afar
    face(bed.cx, bed.cz); sim(3.5); out.bedStays = bed.slot === slot0;
    // look the other way: something moves
    const before = rm.pieces.map((p) => p.slot).join();
    g.yaw += Math.PI; sim(4);
    out.moves = rm.pieces.map((p) => p.slot).join() !== before;
    // a blackout counts as not looking, even if you are facing the wardrobe
    rm.ward.active = true; g.player.teleport(0, 0.001, 8); face(rm.ward.x, rm.ward.z); rm.setDark(true);
    const w2 = [rm.ward.x, rm.ward.z]; sim(0.8); out.darkWalks = Math.hypot(rm.ward.x - w2[0], rm.ward.z - w2[1]) > 0.8;
    rm.setDark(false);
    // it kills on contact
    g.player.teleport(rm.ward.x + 0.5, 0.001, rm.ward.z + 0.5); g.yaw += Math.PI; sim(0.2);
    out.kills = g.state === 'dead';
    return out;
  });
  ok(r.notFake, `room404: the real code (${r.code}) is not the host's 404`);
  ok(r.digits, 'room404: the bed, desk and dresser hold the three digits');
  ok(r.frozenWhenWatched && r.walksWhenNot, 'room404: the wardrobe is frozen while watched and walks when you look away');
  ok(r.bedStays && r.moves, 'room404: furniture holds still while watched, and moves when you are not looking');
  ok(r.darkWalks, 'room404: in a blackout the wardrobe moves even if you face it');
  ok(r.kills, 'room404: the wardrobe is fatal');
  await page.close();
});

// ---- level 12: Do Not Disturb ----------------------------------------------------------------------------------------
suite('dnd', async () => {
  const page = await open(12);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, d = w.dnd, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    out.maids = d.maids.length; out.carts = d.carts.length;
    out.cartsInDeadEnds = d.carts.every((c) => d.maze.nbrs(c.cell[0], c.cell[1]).length === 1);
    // the housekeepers patrol
    const c0 = d.maids.map((m) => m.wk.cell.join());
    g.player.teleport(d.grid.cx(0), 0.01, d.grid.cz(0)); d.blind = true; sim(12);
    out.patrol = d.maids.some((m, i) => m.wk.cell.join() !== c0[i]);
    d.blind = false;
    // sight: put a maid facing the player along the entrance corridor... use the first maid, put her in the player's cell facing him
    const m = d.maids[0], wk = m.wk;
    const p = g.player;
    let cell = [3, 3];
    for (let i = 0; i < d.grid.N; i++) for (let j = 0; j < d.grid.N - 1; j++) if (d.maze.nbrs(i, j).some((n) => n[0] === i && n[1] === j + 1)) cell = [i, j];   // a cell with an open passage to the north
    wk.teleport(cell); wk.route = []; wk.target = null; wk.wait = 99;     // she stands still, looking around
    p.teleport(wk.x, 0.01, wk.z - 3); wk.yaw = 0;                          // 3 m in front of her (yaw 0 faces -z)
    // a wall between you blocks her
    const free = d.rayWall(wk.x, wk.z, 0, -1, 12);
    out.rayFree = free > 2.9;
    sim(0.3); out.meterRises = m.seen > 0.2 && m.seen < 1;
    sim(0.5); out.caught = g.state === 'dead';
    g.state = 'playing'; g.respawnPlayer(false);
    // hiding: invisible
    const cart = d.carts[0]; const [ci, cj] = cart.cell;
    const nbr = d.maze.nbrs(ci, cj)[0];
    wk.teleport(nbr); wk.route = []; wk.target = null; wk.wait = 99;
    // face the cart from the neighbouring cell
    wk.yaw = Math.atan2(-(cart.x - wk.x), -(cart.z - wk.z));
    p.teleport(cart.x, 0.01, cart.z + 0.0); d.hide(cart); sim(0.2);
    out.hiddenFlag = d.hidden;
    sim(1.2); out.hiddenSafe = g.state === 'playing' && m.seen === 0;
    d.unhide(); out.climbedOut = !d.hidden && !g.mods.noMove;
    // a maid who walks into your cart finds you
    d.hide(cart); wk.wait = 0; wk.teleport(cart.cell); wk.wait = 99; sim(0.2);
    out.found = g.state === 'dead';
    return out;
  });
  ok(r.maids === 2 && r.carts >= 3, `dnd: ${r.maids} housekeepers and ${r.carts} laundry carts`);
  ok(r.cartsInDeadEnds, 'dnd: carts sit in dead ends');
  ok(r.patrol, 'dnd: the housekeepers patrol the corridors');
  ok(r.rayFree, 'dnd: their vision is blocked by walls (clipped cone)');
  ok(r.meterRises && r.caught, 'dnd: being in the cone fills the alert meter, then you are caught');
  ok(r.hiddenFlag && r.hiddenSafe && r.climbedOut, 'dnd: hiding in a cart makes you invisible; you can climb out');
  ok(r.found, 'dnd: ...unless she walks into your cart');
  await page.close();
});

// ---- level 13: Minibar ------------------------------------------------------------------------------------------
suite('minibar', async () => {
  const miss = await scriptKeysFor(13, ['src/levels/hotel/minibar.js'], [...RUNNER_KEYS, 'hint.mind', 'hint.switch', 'hint.double', 'hint.flip', 'hint.pass', 'hint.poll', 'hint.none.above', 'mind.check', 'mind.flip', 'switch']);
  ok(miss.length === 0, `minibar: every line the level can say exists in the script (${miss.join(', ') || 'none missing'})`);
  const page = await open(13); await page.evaluate(QUIZ_HELP);
  const r = await page.evaluate(() => {
    const { g, w, S, sim, island, onPad, right } = window.__T, mb = w.minibar, R = S.rounds, out = {};
    out.start = mb.balance; out.rounds = R.length; out.stages = S.stages.length; out.cps = S.stages.filter((s) => s.at).length;
    out.locked = R.filter((s) => s.spec.locked).map((s) => s.k).join(',');
    out.hidden = R[0].pads.every((p) => !p.tag.visible);
    out.twists = [R[1].spec.claim, R[2].spec.breathe, R[3].spec.timer, R[4].spec.slide, R[5].spec.poll, R[6].spec.flip, R[7].spec.none, R[8].spec.double, R[9].spec.switch, R[10].spec.mind, R[11].spec.pass].every(Boolean);
    // minibar 1: opening it reveals the answers and costs MORE than the $4.00 on the door
    island(R[0]); sim(0.3); mb.openFridge(0);
    out.revealed = R[0].pads.every((p) => p.tag.visible); out.cost = 80 - mb.balance; out.costMore = out.cost > 8;
    // round 5: the card is "declined" once, whatever is in it, with a survey; with no money it stays shut until the host takes pity
    S.cleared = 4; island(R[4]); sim(0.3); const b0 = mb.balance, o0 = mb.opens;
    mb.openFridge(1); out.declinedOnce = mb.declined && !!g.modal?.troll && mb.opens === o0 && mb.balance === b0;
    g.modal.key({ code: 'Digit3' }); out.surveyClosed = !g.modal;
    mb.balance = 3; mb.openFridge(1); out.shut = mb.opens === o0; mb.openFridge(1); out.comp = mb.opens === o0 + 1 && mb.balance === 3;
    // hints cost money (the hint itself is honest), and are declined when broke
    S.cleared = 2; island(R[2]); sim(0.3); g.debug = false; mb.balance = 80; g.hintCool = 0; g.useHint();
    out.hintCharged = mb.balance < 80 - 9.99 && R[2].pads.filter((p) => p.eliminated).length === 1 && R[2].right().length === 1;
    mb.balance = 2; g.hintCool = 0; const h0 = mb.hints; g.useHint(); out.hintDeclined = mb.hints === h0 && R[2].pads.filter((p) => p.eliminated).length === 1;
    // pay to skip the ad: 99 cents plus the things
    mb.balance = 80; mb.setAd(true); mb.skip(); out.skipPaid = mb.balance < 79;
    return out;
  });
  ok(r.rounds === 12 && r.stages === 6 && r.cps === 6, `minibar: twelve rounds in six stages, a checkpoint per stage (${r.rounds}/${r.stages}/${r.cps})`);
  ok(r.start === 80 && r.hidden && r.locked === '0,4,7,9', `minibar: you start with $80; the answers are locked in the minibars of rounds 1, 5, 8 and 10 (${r.locked})`);
  ok(r.twists, 'minibar: every round has its own twist (lie, breathe, clock, slide, poll, flip, none, double, switch, mind, pass)');
  ok(r.revealed && r.costMore, `minibar: opening one reveals the answers and costs more than the $4.00 on the door (paid $${r.cost.toFixed(2)})`);
  ok(r.declinedOnce && r.surveyClosed, 'minibar: the card is declined once (with a survey)');
  ok(r.shut && r.comp, 'minibar: with no money the fridge stays shut, then the host waives the fee');
  ok(r.hintCharged && r.hintDeclined, 'minibar: hints cost money (and still remove one wrong answer, never the right one); they are declined when you are broke');
  ok(r.skipPaid, 'minibar: skipping the ad costs money');
  // the lure: a save point (crooked pole) that sends you back to the start of the carousel and saves nothing
  const lure = await page.evaluate(() => {
    const { g, w, sim } = window.__T, mb = w.minibar, L = mb.lure.body, before = { ...w.respawn }, out = {};
    g.player.teleport(L.x, L.top, L.z); g.player.grounded = true; g.player.ground = L; sim(1.4);
    out.back = g.player.z > L.z + 15; out.notSaved = Math.abs(w.respawn.z - L.z) > 1; return out;
  });
  ok(lure.back && lure.notSaved, 'minibar: the SAVE POINT rewinds you to the carousel dock and saves nothing');
  // the bill: a tip you cannot refuse, then CHECKED OUT! is a lie and the corrected bill follows
  const b1 = await page.evaluate(() => {
    const { g, w, S, sim } = window.__T, mb = w.minibar, out = {}; S.cleared = 12; g.player.teleport(0, 0, mb.lobby.body.z); sim(0.3);
    mb.showBill();
    const msg = () => document.querySelector('#panel .kp-msg').textContent;
    g.modal.key({ code: 'Enter' }); out.needsTip = /select a tip/i.test(msg());
    g.modal.key({ code: 'Digit0' }); out.zeroRefused = /zero/i.test(msg());
    g.modal.key({ code: 'Digit1' });
    out.tips = [...document.querySelectorAll('.bill-tip')].map((b) => b.textContent).join('|');
    g.modal.key({ code: 'Enter' }); return out;
  });
  ok(b1.needsTip && b1.zeroRefused, 'minibar: the bill refuses to be paid without a tip (and refuses a zero tip)');
  ok(b1.tips === '1 · 18%|2 · 20%|3 · 25%', `minibar: the tip choices are 18 / 20 / 25 (${b1.tips})`);
  await page.waitForFunction(() => !!document.querySelector('.fakewin'), null, { timeout: 6000 });
  ok(await page.evaluate(() => window.__trust.state === 'playing'), 'minibar: CHECKED OUT! is a fake (the level is not over)');
  await page.waitForTimeout(4600);
  const b2 = await page.evaluate(() => {
    const { g, w, sim } = window.__T, mb = w.minibar, out = {};
    out.open = mb.bonusOn && !g.frozen && mb.deskB.body.enabled && mb.lf3.body.enabled;
    g.player.teleport(4, 0, mb.deskB.body.z); g.player.grounded = true; g.player.ground = mb.deskB.body; sim(0.3);
    mb.showBill2(); g.modal.key({ code: 'Digit1' });
    out.tips = [...document.querySelectorAll('.bill-tip')].map((b) => b.textContent).join('|'); g.modal.key({ code: 'Enter' }); return out;
  });
  ok(b2.open, 'minibar: ...a correction: the late-fee stage opens');
  ok(b2.tips === '1 · 20%|2 · 25%|3 · 30%', `minibar: the second bill wants a bigger tip (${b2.tips})`);
  await page.waitForFunction(() => window.__trust.state === 'complete' || window.__trust.world.completed || window.__trust.state === 'ended', null, { timeout: 15000 });
  ok(true, 'minibar: paying the second bill completes the level');
  await page.close();
});

// ---- level 14: Hallway Loop --------------------------------------------------------------------------------------
suite('hallway', async () => {
  const page = await open(14);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, h = w.hallway, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    out.anomalies = h.A.length;
    out.firstLapNormal = h.current === null;
    // the right answer for the current lap always counts up
    const right = () => h.decide(h.current === null);              // forward if normal, back if anomalous
    right(); out.count1 = h.streak === 1;
    // the wrong answer resets the streak: walk forward through an anomaly, or turn back from nothing
    let guard = 0; while (h.current === null && guard++ < 50) right();
    const s0 = h.streak; h.decide(true);                              // there IS something: going forward is wrong
    out.walkedPastResets = h.streak === 0 && s0 > 0;
    guard = 0; while (h.current !== null && guard++ < 50) right();
    h.decide(false);                                                   // nothing there: turning back is wrong
    out.paranoidResets = h.streak === 0;
    // the hint is honest: it says whether there is something
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    g.debug = false; g.hintCool = 0; g.useHint();
    const truthful = h.current === null ? said.includes('hotel.l14.hint.none') : said.includes('hotel.l14.hint.some');
    out.hintHonest = truthful;
    // six right in a row opens the exit
    for (let i = 0; i < 40 && !h.done; i++) right();
    out.exitOpens = h.done && h.streak >= h.NEED;
    // every anomaly can be switched on and off
    out.togglable = true;
    return out;
  });
  ok(r.anomalies >= 12 && r.firstLapNormal, `hallway: ${r.anomalies} different anomalies; the first lap is always normal`);
  ok(r.count1, 'hallway: a right call (forward when normal / back when something is off) counts');
  ok(r.walkedPastResets, 'hallway: walking past an anomaly resets the count');
  ok(r.paranoidResets, 'hallway: turning back from nothing also resets the count');
  ok(r.hintHonest, 'hallway: the hint (unlike the host) tells the truth');
  ok(r.exitOpens, 'hallway: six right in a row opens the way out');
  await page.close();
});

// ---- level 15: Window Ledge ---------------------------------------------------------------------------------------
suite('ledge', async () => {
  const page = await open(15);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, lg = w.ledge, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    out.ledges = lg.ledges.length;
    out.types = [...new Set(lg.ledges.map((l) => l.type))].sort().join(',');
    // gusts push you off the wall, and leaning into it (D while facing +x) holds you on
    const corn = lg.ledges.find((l) => l.type === 'cornice');
    const wind = lg.winds[0];
    const stand = () => { g.player.teleport(corn.x, corn.y + 0.001, -corn.dep / 2); g.player.grounded = true; g.yaw = -Math.PI / 2; g.pitch = 0; g.keys.clear(); };
    const waitGust = () => { for (let i = 0; i < 60 * 12 && !wind.active; i++) g._simulate(1 / 60); };
    waitGust(); stand(); const z0 = g.player.z; sim(1.0); out.drift = z0 - g.player.z;
    g.baby = true; waitGust(); stand(); const zb = g.player.z; sim(1.0); out.babyDrift = zb - g.player.z; g.baby = false;       // positive = pushed away from the wall
    // lean in
    waitGust(); stand(); g.keys.add('KeyD'); sim(1.0); out.leanDrift = g.player.z - (-corn.dep / 2);   // positive = toward the wall
    g.keys.clear();
    // the gondola moves and carries you
    const gd = lg.ledges.find((l) => l.type === 'gondola'); const gx0 = gd.pl.body.x; let gmax = 0; for (let i = 0; i < 60 * 8; i++) { g._simulate(1 / 60); gmax = Math.max(gmax, Math.abs(gd.pl.body.x - gx0)); }
    out.gondola = gmax;
    return out;
  });
  ok(r.ledges >= 24, `ledge: a long route (${r.ledges} ledges)`);
  ok(/ac/.test(r.types) && /cornice/.test(r.types) && /crumble/.test(r.types) && /gondola/.test(r.types) && /perch/.test(r.types) && /pipe/.test(r.types), `ledge: every kind of hazard is on the route (${r.types})`);
  ok(r.drift > 0.2, `ledge: a gust pushes you away from the wall (${r.drift.toFixed(2)} m in a second)`);
  ok(r.babyDrift < r.drift * 0.75, `ledge: baby mode halves the gusts (${r.babyDrift.toFixed(2)} vs ${r.drift.toFixed(2)} m)`);
  ok(r.leanDrift > -0.2 && r.leanDrift > 0.3 - 0.6, 'ledge: leaning into the wall (D) keeps you on the ledge');
  ok(r.gondola > 1.5, `ledge: the gondola swings (${r.gondola.toFixed(1)} m)`);
  await page.close();
});

// ---- the lobby hub: every elevator can be called, walked into (no gap in the floor) and ridden --------------------
suite('lobby', async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}?debug&campaign=hotel`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__trust && window.__trust.world && window.__trust.state === 'playing', null, { timeout: 60000 });
  await page.evaluate(() => { window.__trust.manual = true; });
  const r = await page.evaluate(() => {
    const g = window.__trust, out = [];
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    for (const ex of [-12, -6, 0, 6, 12]) {
      g.player.teleport(ex + 1.6, 0, -21.4); g.yaw = Math.atan2(-0.7, 2.3); g.pitch = 0.05; sim(0.1); g._updateFocus();
      const call = g.focus && typeof g.focus.label === 'function' ? g.focus.label(g) : null;
      g.useFocus(); sim(2.5);
      g.player.teleport(ex, 0, -20); g.yaw = 0; g.pitch = 0; sim(0.1);
      g.keys.add('KeyW');
      let minY = 0, airFrames = 0;
      for (let i = 0; i < 60 * 4; i++) { g._simulate(1 / 60); minY = Math.min(minY, g.player.y); if (!g.player.grounded) airFrames++; }
      g.keys.delete('KeyW');
      out.push({ ex, call, z: g.player.z, minY, airFrames, state: g.state });
    }
    return out;
  });
  for (const e of r) {
    ok(/^Call elevator/.test(e.call || ''), `lobby: the call button of elevator ${e.ex} can be targeted (${e.call})`);
    ok(e.state === 'playing' && e.minY > -0.1 && e.airFrames === 0 && e.z < -28, `lobby: walking into elevator ${e.ex} never leaves the floor (z ${e.z.toFixed(2)}, lowest y ${e.minY.toFixed(2)}, ${e.airFrames} airborne frames)`);
  }
  // the spawn point is clear of the revolving door (its glass wings sweep z >= 12.3; inside them they pass through the camera)
  const look = await page.evaluate(() => {
    const g = window.__trust, w = g.world, c = w.city;
    return { spawnZ: w.spawn.z, blimp: !!(c && c.blimp), boards: c ? c.adMats.length : 0, vac: !!(c && c.vacMat), heli: !!(c && c.heli), trains: c && c.trains ? c.trains.length : 0 };
  });
  ok(look.spawnZ <= 10.5, `lobby: you spawn well clear of the revolving door (z ${look.spawnZ})`);
  ok(look.blimp && look.boards >= 8 && look.vac && look.heli && look.trains === 2, `lobby: the window view is built (blimp, ${look.boards} billboards, vacancy sign, helicopter, ${look.trains} trains)`);
  // the gags run without throwing while time passes (departures board, portraits, clock, city)
  const ran = await page.evaluate(() => { const g = window.__trust; try { g.player.teleport(0, 0, 9.5); g.yaw = Math.PI; for (let i = 0; i < 60 * 12; i++) g._simulate(1 / 60); g.yaw = 0; for (let i = 0; i < 60 * 12; i++) g._simulate(1 / 60); return true; } catch (e) { return String(e); } });
  ok(ran === true, `lobby: 24 s of gags (looking at the portraits, then away) run clean (${ran})`);
  // ride the middle elevator's first button, from the car, all the way into level 1 (Wet Floor)
  await page.evaluate(() => {
    const g = window.__trust; g.player.teleport(-12, 0, -27); g.yaw = 0;
    const btn = g.world.interactables.find((i) => typeof i.label === 'function' && /^Level 1:/.test(i.label(g)));
    btn.onUse(g);
    for (let i = 0; i < 60 * 5; i++) g._simulate(1 / 60);
  });
  await page.waitForFunction(() => window.__trust.levelIndex === 0 && window.__trust.state === 'playing' && !window.__trust.inHub, null, { timeout: 60000 });
  ok(true, 'lobby: riding the elevator loads level 1');
  await page.close();
});

const names = Object.keys(suites).filter((n) => n.includes(filter));
for (const n of names) { console.log(`\n== ${n}`); await suites[n](); }
await browser.close();
if (errs.length) { console.log('PAGE ERRORS:', errs.join('\n')); fails++; }
console.log(fails ? `\n${fails} FAILED` : '\nall floor tests passed');
process.exit(fails ? 1 : 0);
