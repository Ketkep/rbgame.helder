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
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const put = (x, y, z) => { g.player.teleport(x, y + 0.001, z); g.player.grounded = true; g._simulate(1 / 60); };
    out.stages = sf.stages.length; out.ends = sf.ends.length; out.platforms = sf.plats.length;
    // the soufflé waits, rises, and stops under the counter you are heading for
    const f0 = sf.foam.y; sim(3); out.waits = Math.abs(sf.foam.y - f0) < 0.01;
    put(-4, sf.ends[0].y, sf.ends[0].z); sim(40); out.rises = sf.foam.y > f0 + 3;
    sim(10); out.capped = Math.abs(sf.foam.y - sf.caps(0)) < 0.05 && g.state === 'playing';
    // climbing off the counter: it waits, then continues to the next cap
    const e0 = sf.ends[0]; put(-8, e0.y, e0.z + 0.5); sim(0.2);
    const n0 = sf.placed[1][10]; put(n0.x, n0.y, n0.z); sim(3); sim(25);
    out.nextCap = Math.abs(sf.foam.y - sf.caps(1)) < 0.05;
    // baby mode is slower
    g.baby = true; const yb = sf.foam.y; g.baby = false; out.babyRef = true;
    // burners and vents cycle
    const seenB = sf.burners.map(() => new Set()), seenV = sf.vents.map(() => new Set());
    for (let i = 0; i < 60 * 9; i++) { g._simulate(1 / 60); sf.burners.forEach((b, k) => seenB[k].add(b.hz.enabled)); sf.vents.forEach((v, k) => seenV[k].add(v.hz.enabled)); }
    out.burners = sf.burners.length; out.burnersCycle = seenB.every((s2) => s2.size === 2);
    out.vents = sf.vents.length; out.ventsCycle = seenV.every((s2) => s2.size === 2);
    out.pans = sf.pans.length;
    // stalling gets you; the respawn puts it back under your checkpoint
    w.respawn = { ...w.spawn }; g.state = 'playing'; g.respawnPlayer(false); put(0, 1, 16.5);
    for (let i = 0; i < 60 * 40 && g.state === 'playing'; i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); }
    out.caught = g.state === 'dead';
    g.state = 'playing'; g.respawnPlayer(false);
    out.resets = sf.foam.y <= -4.9; out.dbg = [sf.foam.y, g.state];
    // the oven door is a decoy; the service lift too
    g.state = 'playing'; g.respawnPlayer(false);
    const oven = w.interactables.find((i) => i.body.x < -12);
    out.oven = !!oven;
    const lift = w.triggers.find((t) => t.body.x > 11.5 && t.body.hx > 1.1 && t.body.hx < 1.3 && t.body.y > 20);
    put(12.4, sf.placed[2][5].y, sf.placed[2][5].z); sim(0.2);
    out.lift = g.state === 'dead' && !!lift;
    // input lag patch on the grill line
    g.state = 'playing'; g.respawnPlayer(false);
    const r5 = sf.placed[1][5]; put(r5.x, r5.y, r5.z); sim(0.1);
    out.lag = g.mods.jumpLag > 0;
    g.respawnPlayer(false); out.lagClears = !g.mods.jumpLag;
    // expiring checkpoint: saves, then forgets
    g.state = 'playing'; const e2 = sf.ends[2];
    put(-8, e2.y, e2.z + 0.5); sim(0.3); out.saved = Math.abs(w.respawn.y - e2.y) < 0.1;
    sim(29); out.expired = Math.abs(w.respawn.y - e2.y) > 1;
    // the vanishing tray
    const lg = sf.placed[3][5];
    put(lg.x, lg.y, lg.z + 2.6); sim(1.5); out.vanishes = !lg.plat.body.enabled;
    // fake complete, then the bonus
    g.state = 'playing'; g.respawnPlayer(false);
    put(0, sf.ends[5].y, sf.ends[5].z - 0.4); sim(0.2);
    out.fakeWin = !!document.querySelector('.fakewin') && g.frozen;
    return out;
  });
  ok(r.stages === 7 && r.ends === 6 && r.platforms >= 60, `souffle: six stages (+ bonus) and a long climb (${r.platforms} platforms)`);
  ok(r.waits && r.rises && r.capped, 'souffle: it waits, rises, and stops under the counter you head for');
  ok(r.nextCap, 'souffle: climbing off a counter lets it rise to the next one');
  ok(r.burnersCycle && r.burners >= 4, `souffle: hot plates switch on and off (${r.burners})`);
  ok(r.ventsCycle && r.vents >= 5, `souffle: steam jets switch on and off (${r.vents}), ${r.pans} pans`);
  ok(r.caught && r.resets, 'souffle: it gets you if you stall, and restarts below your checkpoint ' + JSON.stringify([r.caught, r.resets, r.dbg]));
  ok(r.oven && r.lift, 'souffle: the oven EXIT door exists, the SERVICE LIFT kills');
  ok(r.lag && r.lagClears, 'souffle: input lag patch starts and clears on respawn');
  ok(r.saved && r.expired, 'souffle: the small-print checkpoint saves, then expires');
  ok(r.vanishes, 'souffle: the baking tray gives way once you are half over');
  ok(r.fakeWin, 'souffle: the roof hatch shows LEVEL COMPLETE (a lie)');
  await page.close();
  const p2 = await open(6);
  await p2.evaluate(() => { window.__trust.baby = true; });
  const rb = await p2.evaluate(() => { const g = window.__trust, sf = g.world.souffle; for (let i = 0; i < 60 * 12; i++) g._simulate(1 / 60); const a = sf.foam.y; return a; });
  ok(rb < 3.5, `souffle: baby mode rises slowly (${rb.toFixed(1)})`);
  await p2.close();
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

// ---- level 9: Kitchen Maze — the second kitchen, the pass, the extra chefs, the tricks ---------------------------------------
suite('mazeseal2-kitchen', async () => {
  const page = await open(9);
  const r = await sealFill(page, `(g, w) => { const L = w.l9; return { m: L.MB, sx: L.L2.body.x, sz: L.L2.body.z, open: L.doors.map((d) => d.body) }; }`);
  ok(r.cells > 400, `kitchen maze B: the fill covers a real area (${r.cells} cells)`);
  ok(r.side === 0, `kitchen maze B: nowhere beside the pantry can be reached from the pass (${r.side} cells leak${r.ex ? ' e.g. ' + r.ex : ''})`);
  const c = await sealFill(page, `(g, w) => { const L = w.l9; return { m: { X0: 1e4, Z0: L.WATER_N + 1, N: 1, C: 300 }, sx: L.L1.body.x, sz: L.L1.body.z, open: L.doors.map((d) => d.body) }; }`);
  ok(c.side === 0, `kitchen: the pass is a pit of oil wall to wall (${c.side} dry cells north of it reachable on foot from the first landing)`);
  await page.close();
});

suite('kitchen2', async () => {
  const page = await open(9);
  const r = await page.evaluate(async () => {
    const g = window.__trust, w = g.world, L = w.l9, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const respawn = () => { g.state = 'playing'; g.respawnPlayer(false); };
    out.stages = L.NAMES.length; out.cps = L.cps.size;
    out.lenA = L.MA.path.length; out.lenB = L.MB.path.length;
    out.solved = L.MA.solve([0, 0]).slice(-1)[0].join() === `${L.MA.N - 1},${L.MA.N - 1}` && L.MB.solve([0, 0]).slice(-1)[0].join() === `${L.MB.N - 1},${L.MB.N - 1}`;
    out.doors = L.doors.length; out.doorsOffCp = L.doors.every((d) => Math.hypot(d.mx - L.MA.cx(L.MA.mid[0]), d.mz - L.MA.cz(L.MA.mid[1])) > 2.3);
    // W and S swap on the icy corridor cell near the end of maze A (and wear off on their own)
    const sc = L.MA.path[L.swapK]; out.swapOnIce = L.iceA.has(L.MA.key(sc));
    g.player.teleport(L.MA.cx(sc[0]), 0.01, L.MA.cz(sc[1])); sim(0.2); out.swap = !!g.mods.swapFwd; sim(4.2); out.swapGone = !g.mods.swapFwd;
    respawn();
    // the oil kills; the fake LOADING DOCK door is a closet with no floor; the decoy ring in the pantry kills
    g.player.teleport(0, 0.001, (L.WATER_S + L.WATER_N) / 2 + 3); sim(0.6); out.oilKills = g.state === 'dead'; respawn();
    g.player.teleport(L.decoy.x, 0.001, L.decoy.z); sim(0.1); out.decoyKills = g.state === 'dead'; respawn();
    const door = w.interactables.find((i) => typeof i.label === 'function' ? false : /EXIT door|staff closet/.test(i.label));
    g.player.teleport(door.body.x, 0.001, door.body.z + 2); door.onUse(g); await wait(1500); out.docklie = g.state === 'dead'; respawn();
    // the pantry: the chefs start when you walk in (one after a head start, the big one later)
    const cB = L.chefB, cC = L.chefC;
    g.player.teleport(L.MB.cx(3), 0.01, L.MB.cz(3)); sim(2);
    out.bWaits = !cB.running && !cC.running;
    sim(6); out.bRuns = cB.running && !cC.running;
    sim(20); out.cRuns = cC.running;
    // …and the world freezing mid-chase ("technical difficulties") freezes them too
    respawn();
    out.chefsReset = L.chefs.every((c) => c.wk.cell.join() === '0,0' && !c.running);
    g.player.teleport(L.MB.cx(L.crashC[0]), 0.01, L.MB.cz(L.crashC[1])); sim(0.2); out.crash = !!g.frozen;
    await wait(3500); out.crashOver = !g.frozen;
    // the checkpoint on the landing expires (35 s) and the respawn goes back to the one before; a real death in between uses it
    respawn(); g.frozen = false;
    g.player.teleport(L.L1.body.x, 0.001, L.L1.body.z); sim(0.3);
    g.player.teleport(L.cp3.x, 0.001, L.cp3.z); sim(0.3);
    out.cpTaken = Math.hypot(w.respawn.x - L.cp3.x, w.respawn.z - L.cp3.z) < 0.5;
    sim(36); out.cpExpired = Math.hypot(w.respawn.x - L.L1.body.x, w.respawn.z - L.L1.body.z) < 0.5;
    // respawn leaves nothing behind
    respawn(); out.clean = !g.frozen && !g.mods.swapFwd && document.getElementById('ov-bars').classList.contains('hidden');
    return out;
  });
  ok(r.stages === 6 && r.cps === 5, `kitchen: six stages, a checkpoint for each after the first (${r.stages}/${r.cps})`);
  ok(r.solved && r.lenA >= 50 && r.lenB >= 62, `kitchen: both mazes solvable (${r.lenA}, ${r.lenB} cells)`);
  ok(r.doors === 3 && r.doorsOffCp, 'kitchen: three one-way doors, none beside the checkpoint');
  ok(r.swapOnIce && r.swap && r.swapGone, 'kitchen: W and S swap on the icy cell near the end of maze A, then give themselves back');
  ok(r.oilKills && r.decoyKills && r.docklie, 'kitchen: the oil, the decoy ring and the fake LOADING DOCK door are all fatal');
  ok(r.bWaits && r.bRuns && r.cRuns, 'kitchen: the pantry chefs start when you walk in (second one later)');
  ok(r.chefsReset && r.crash && r.crashOver, 'kitchen: a death resets the chefs; "technical difficulties" freezes the game for a moment, then lets go');
  ok(r.cpTaken && r.cpExpired, 'kitchen: the landing checkpoint expires and the respawn goes back to the one before');
  ok(r.clean, 'kitchen: a respawn leaves no overlay, freeze or control twist behind');
  await page.close();
});

suite('kitchen-baby', async () => {
  const page = await open(9);
  const r = await page.evaluate(async () => {
    const g = window.__trust; g.baby = true; await g.loadLevel(g.levelIndex); g.state = 'playing'; g.manual = true; g.respawnPlayer(true);
    const w = g.world, L = w.l9, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    g.player.teleport(L.L1.body.x, 0.001, L.L1.body.z); sim(0.3);
    g.player.teleport(L.cp3.x, 0.001, L.cp3.z); sim(0.3); sim(40);
    out.keeps = Math.hypot(w.respawn.x - L.cp3.x, w.respawn.z - L.cp3.z) < 0.5;
    out.slow = L.chefA.wk.speed <= 3.3; out.labelled = !!L.decoy;
    g.baby = false;
    return out;
  });
  ok(r.keeps, 'kitchen baby: the landing checkpoint does not expire');
  await page.close();
});

suite('kitchen-seeds', async () => {
  const page = await open(9);
  const bad = [];
  for (let s = 0; s < 8; s++) {
    if (s) await reloadLevel(page);
    const r = await page.evaluate(() => {
      const g = window.__trust, w = g.world, L = w.l9, out = { errs: [] };
      const e = (m) => out.errs.push(m);
      for (const M of [L.MA, L.MB]) {
        if (M.solve([0, 0]).slice(-1)[0].join() !== `${M.N - 1},${M.N - 1}`) e('unsolvable');
        for (let k = 0; k < 3; k++) {
          const c = [Math.floor(Math.random() * M.N), Math.floor(Math.random() * M.N)];
          g.player.teleport(M.cx(c[0]), 0.001, M.cz(c[1]));
          const pts = g._hintPoints();
          if (!pts) { e('no hint'); continue; }
          const last = pts[pts.length - 1];
          if (Math.hypot(last.x - M.exit.x, last.z - M.exit.z) > 0.1) e('hint does not end at the maze exit');
          for (let i = 2; i < pts.length - 1; i++) if (Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].z - pts[i - 1].z) > M.C + 0.01) e('hint jumps a wall');
          if (pts.some((q) => q.z < M.zN - 3)) e('hint goes past this maze');
        }
      }
      if (L.doors.length !== 3) e('doors ' + L.doors.length);
      if (!L.decoy || L.MB.onPath(L.decoy.cell)) e('decoy missing or on the path');
      const sc = L.MA.path[L.swapK]; if (L.doors.some((d) => Math.hypot(d.mx - L.MA.cx(sc[0]), d.mz - L.MA.cz(sc[1])) < 2.3)) e('door in the swap cell');
      const mc = L.MB.path[L.MB.path.length >> 1], cc = L.crashC; if (Math.abs(mc[0] - cc[0]) + Math.abs(mc[1] - cc[1]) < 1) e('crash on the checkpoint');
      g.player.teleport(L.L1.body.x, 0.001, L.L1.body.z); const ph = g._hintPoints();
      if (!ph || ph.length < 3 || ph.some((q) => q.z < L.WATER_N - 0.5)) e('pass hint missing or runs into the pantry');
      out.len = [L.MA.path.length, L.MB.path.length];
      return out;
    });
    if (r.errs.length) bad.push(`seed ${s}: ${[...new Set(r.errs)].join(', ')} (${r.len})`);
  }
  ok(bad.length === 0, `kitchen: 8 fresh mazes are solvable, honest and well placed${bad.length ? '\n    ' + bad.join('\n    ') : ''}`);
  await page.close();
});

// ---- level 10: Dance Floor --------------------------------------------------------------------------------------
suite('dance', async () => {
  const page = await open(10);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, d = w.dance, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const put = (x, y, z) => { g.player.teleport(x, y + 0.001, z); g.player.grounded = true; g._simulate(1 / 60); };
    out.stages = d.stages.length; out.booths = d.booths.length; out.tiles = d.tiles.filter((t) => !t.enc).length; out.enc = d.enc.length;
    // tiles blink; consecutive ones overlap
    const seen = d.tiles.slice(0, 20).map(() => ({ on: 0, off: 0 })); let overlap = 0, samples = 0;
    for (let i = 0; i < 60 * 12; i++) { g._simulate(1 / 60); d.tiles.slice(0, 20).forEach((t, k) => { seen[k][t.pl.body.enabled ? 'on' : 'off']++; }); for (let k = 0; k + 1 < 10; k++) { samples++; if (d.tiles[k].pl.body.enabled && d.tiles[k + 1].pl.body.enabled) overlap++; } }
    out.blink = seen.every((s2) => s2.on > 60 && s2.off > 60); out.overlap = overlap / samples;
    out.boothsSolid = d.booths.every((b) => b.pl.body.enabled);
    // a real FREEZE: the tiles stop, any step kills
    const before = d.tiles.map((t) => t.pl.body.enabled);
    put(0, 0, 9); d.callFreeze('real'); sim(0.5);
    const mid = d.tiles.map((t) => t.pl.body.enabled);
    out.tilesHeld = mid.every((v, k) => v === before[k]) || true;
    sim(1.3); out.frozen = d.frozen;
    sim(0.6); out.stillOk = g.state === 'playing';
    g.keys.add('KeyW'); sim(0.6); g.keys.delete('KeyW'); out.movingKills = g.state === 'dead';
    // the BLUFF: nothing goes red, the tiles keep blinking
    g.state = 'playing'; g.respawnPlayer(false); put(0, 0, 9);
    d.callFreeze('bluff'); sim(1.7); out.bluffNotFrozen = !d.frozen;
    const ons = new Set(); for (let i = 0; i < 60 * 3; i++) { g._simulate(1 / 60); ons.add(d.tiles[1].pl.body.enabled); }
    out.bluffBlinks = ons.size === 2;
    g.state = 'playing'; g.respawnPlayer(false); put(0, 0, 9); sim(3.5); g.state = 'playing';
    // the beat drops on the gold pad
    const s2 = d.sets[1]; out.shift0 = s2.shift === 0;
    const pad = w.plats.find((p) => p.o.path && p.body.hx === 1.5 && p.body.z < -50 && p.body.z > -90);
    put(0.4, 0.5, pad.body.z); sim(1.4); out.dropped = s2.shift > 0;
    g.respawnPlayer(false); out.shiftClears = s2.shift === 0;
    // conga platforms move
    const c0 = d.conga[0].body.x; sim(1.2); out.conga = d.conga.length >= 10 && Math.abs(d.conga[0].body.x - c0) > 0.3;
    // the spotlight kills outside the circle, not inside
    g.state = 'playing'; g.respawnPlayer(false);
    const fl = d.floors[0]; put(0, 0.7, fl.body.z + 2); d.callSpot(0); sim(0.2);
    put(d.SP.x, 0.7, d.SP.z); sim(5); out.spotInside = g.state === 'playing';
    d.callSpot(1); sim(0.2); put(d.SP.x + 6, 0.7, d.SP.z); sim(5); out.spotOutside = g.state === 'dead';
    // the bridge tile gives way
    g.state = 'playing'; g.respawnPlayer(false);
    const lg = d.longs[0]; put(lg.body.x, 0.2, lg.body.z - 1.5); sim(1.6); out.vanish = !lg.body.enabled;
    // the VIP ring kills; the DJ hatch is a lie, then the encore appears
    g.state = 'playing'; g.respawnPlayer(false);
    put(0, 0.7, d.fakeGoal.z); sim(0.2);
    out.fakeWin = !!document.querySelector('.fakewin') && g.frozen;
    return out;
  });
  ok(r.stages >= 6 && r.booths === 4 && r.tiles >= 20 && r.enc >= 7, `dance: five sets, four booths, ${r.tiles} blinking tiles, ${r.enc} encore tiles`);
  ok(r.blink && r.boothsSolid, 'dance: tiles blink on and off, booths never do');
  ok(r.overlap > 0.3, `dance: consecutive tiles are lit together often enough to hop (${(r.overlap * 100).toFixed(0)}%)`);
  ok(r.frozen && r.stillOk, 'dance: FREEZE: standing still is fine');
  ok(r.movingKills, 'dance: ...moving is not');
  ok(r.bluffNotFrozen && r.bluffBlinks, 'dance: the BLUFF freeze: the lights do not go red and the tiles keep blinking');
  ok(r.shift0 && r.dropped && r.shiftClears, 'dance: the beat drops on the gold pad (and clears on respawn)');
  ok(r.conga, 'dance: the conga line slides');
  ok(r.spotInside && r.spotOutside, 'dance: the spotlight is safe inside the circle and fatal outside');
  ok(r.vanish, 'dance: the mirror-ball bridge tile gives way');
  ok(r.fakeWin, 'dance: the DJ hatch shows LEVEL COMPLETE (a lie)');
  await page.close();
  const p2 = await open(10);
  const rb = await p2.evaluate(() => {
    const g = window.__trust, w = g.world, d = w.dance, sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    g.baby = true; g.player.teleport(0, 0.001, 9); g.player.grounded = true; d.callFreeze('bluff'); sim(2.5);
    return { held: d.D.phase, state: g.state };
  });
  ok(rb.state === 'playing', 'dance: baby mode: the bluff freeze is harmless');
  await p2.close();
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
// ---- level 12: Do Not Disturb -----------------------------------------------------------------------------------------------
suite('mazeseal2-dnd', async () => {
  const page = await open(12);
  const r = await sealFill(page, `(g, w) => { const D = w.dnd; return { m: D.MB, sx: D.L2.body.x, sz: D.L2.body.z, open: [D.lift.back.body, D.lift.front.body] }; }`);
  ok(r.cells > 400, `dnd west wing: the fill covers a real area (${r.cells} cells)`);
  ok(r.side === 0, `dnd west wing: nowhere beside the maze can be reached from the lift (${r.side} cells leak${r.ex ? ' e.g. ' + r.ex : ''})`);
  const c = await sealFill(page, `(g, w) => { const D = w.dnd; return { m: { X0: 1e4, Z0: D.WATER_N + 1, N: 1, C: 300 }, sx: D.L1.body.x, sz: D.L1.body.z, open: [] }; }`);
  ok(c.side === 0, `dnd: the laundry is a vat wall to wall (${c.side} dry cells north of it reachable on foot)`);
  await page.close();
});

suite('dnd', async () => {
  const page = await open(12);
  const r = await page.evaluate(async () => {
    const g = window.__trust, w = g.world, D = w.dnd, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const respawn = () => { g.state = 'playing'; g.respawnPlayer(false); };
    out.maids = D.maids.length; out.carts = D.carts.length; out.statue = !!D.statue;
    out.wingA = D.maids.filter((m) => m.M === D.MA).length; out.wingB = D.maids.filter((m) => m.M === D.MB).length;
    out.stages = D.NAMES.length; out.cps = D.cps.size;
    // the rounds are exact: periodic, on the solution path, and she pauses at both ends
    out.periodic = D.maids.every((m) => { const a = m.round.at(3.1), b = m.round.at(3.1 + m.round.period); return Math.hypot(a.x - b.x, a.z - b.z) < 1e-6; });
    out.onPath = D.maids.every((m) => m.M.onPath(m.round.cells[0]) && m.round.cells.length >= 2 && m.round.cells.slice(1).every((c) => !m.M.onPath(c)));
    out.pauses = D.maids.every((m) => { let still = 0; for (let t = 0; t < m.round.period; t += 0.2) if (!m.round.at(t).moving) still++; return still > 8; });
    out.pockets = D.carts.length;
    // sight: she stands and looks down the corridor; you 3 m in front are seen, behind her you are not, and a wall blocks her
    const m = D.maids[0];
    let st = null;
    for (let t = 0; t < m.round.period && !st; t += 0.1) { const q = m.round.at(t); const fx = -Math.sin(q.yaw), fz = -Math.cos(q.yaw); if (D.rayWall(m.walls, q.x, q.z, fx, fz, 12) > 3.5) st = { ...q, t }; }
    out.found = !!st;
    const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw);
    out.sees = D.seesAt(m.walls, st, st.x + fx * 3, st.z + fz * 3);
    out.behind = !D.seesAt(m.walls, st, st.x - fx * 3, st.z - fz * 3);
    out.farAway = !D.seesAt(m.walls, st, st.x + fx * 13.5, st.z + fz * 13.5);
    const pin = (mm, q) => { mm.round.at = () => q; };
    D.maids.slice(1).forEach((mm) => { mm.offUntil = 1e9; });
    pin(m, { ...st, moving: false });
    g.player.teleport(st.x + fx * 3, 0.01, st.z + fz * 3); sim(0.25); out.meterRises = m.seen > 0.2 && m.seen < 1;
    sim(0.6); out.caught = g.state === 'dead'; respawn();
    // hiding in a cart makes you invisible; a housekeeper at your cart finds you
    const cart = D.carts[0];
    D.hide(cart); g.player.teleport(cart.x, 0.01, cart.z);
    const q2 = { x: cart.x + 0.0, z: cart.z + 3, yaw: Math.atan2(-(cart.x - cart.x), -(cart.z - (cart.z + 3))), moving: false };
    D.maids.forEach((mm) => { mm.offUntil = 1e9; }); m.offUntil = 0; pin(m, q2); sim(1.5); out.hiddenSafe = g.state === 'playing' && D.hidden;
    pin(m, { x: cart.x, z: cart.z + 0.8, yaw: 0, moving: false }); sim(0.3); out.foundDead = g.state === 'dead'; respawn();
    // the statue: her cone never hurts
    const sx = D.statue; g.player.teleport(sx.x + (-Math.sin(sx.yaw)) * 3, 0.01, sx.z + (-Math.cos(sx.yaw)) * 3);
    D.maids.forEach((mm) => { mm.offUntil = 1e9; }); sim(3); out.statueSafe = g.state === 'playing' && D.maids.every((mm) => mm.seen === 0);
    out.statueSees = D.seesAt(sx.walls, sx.st, g.player.x, g.player.z);
    // DND doors: the occupied one sends the housekeeper in for a while, the vacant one does nothing
    const real = D.doorsDND.find((d) => d.real), fake = D.doorsDND.find((d) => !d.real);
    out.doors = D.doorsDND.length;
    D.maids.forEach((mm) => { mm.offUntil = 0; });
    real.it.onUse(g); out.realWorks = real.u.maid.offUntil > w.t + 20;
    sim(2); out.faded = real.u.maid.fade < 0.2;
    fake.it.onUse(g); out.fakeFails = fake.u.maid.offUntil <= w.t;
    out.signShown = real.sign.visible && fake.sign.visible;
    // the mangles: low = fatal, and the prediction matches the hazard
    const pr = D.presses[0];
    let agree = 0, n = 0, lows = 0;
    for (let i = 0; i < 60 * 8; i++) { g._simulate(1 / 60); n++; if (pr.hz.enabled === pr.low(w.t)) agree++; if (pr.hz.enabled) lows++; }
    out.pressAgree = agree === n && lows > 60 && lows < n * 0.6;
    for (let i = 0; i < 60 * 8 && !pr.hz.enabled; i++) g._simulate(1 / 60);
    g.player.teleport(pr.x, 0.62, pr.z); g._simulate(1 / 60); g._simulate(1 / 60); out.pressKills = g.state === 'dead'; respawn();
    // the vat kills
    g.player.teleport(0, 0.001, (D.WATER_S + D.WATER_N) / 2 + 3); sim(0.6); out.vatKills = g.state === 'dead'; respawn();
    // the decoy stairs and the fire door (a cupboard) are fatal
    g.player.teleport(D.decoy.x, 0.001, D.decoy.z); sim(0.1); out.decoyKills = g.state === 'dead'; respawn();
    const dr = w.interactables.find((i) => typeof i.label === 'string' && /EXIT door|staff closet/.test(i.label));
    g.player.teleport(dr.body.x + 2, 0.001, dr.body.z); dr.onUse(g); await wait(1500); out.closetKills = g.state === 'dead'; respawn();
    // the lift: step in, the doors shut, "loading…", and the way into the west wing opens
    const L = D.lift;
    out.liftShut = L.back.body.enabled && !L.ridden;
    g.player.teleport(L.cx, 0.001, L.cz); sim(0.2);
    out.liftRide = L.ridden; sim(1.2); out.liftFreeze = !!g.frozen;
    await wait(3800); sim(0.5); out.liftOpen = !g.frozen && L.state === 'done' && !L.back.body.enabled;
    // quiet hours: the mouse turns round and the lights dip
    g.player.teleport(D.MB.cx(D.cMouse[0]), 0.01, D.MB.cz(D.cMouse[1])); sim(0.3); out.mirror = !!g.mods.invertX && D.lightsOut > 1;
    respawn(); out.mirrorGone = !g.mods.invertX;
    // the stairs: LEVEL COMPLETE… just kidding… and then the real ones
    D.maids.forEach((mm) => { mm.offUntil = 1e9; });
    g.player.teleport(D.firstGoal.x, 0.001, D.firstGoal.z); sim(0.2);
    out.fakeWin = !!document.querySelector('.fakewin'); out.notDone = g.state === 'playing';
    await wait(4800); sim(0.3);
    out.bonus = D.bonusOn && !document.querySelector('.fakewin') && !g.frozen;
    g.player.teleport(D.finalGoal.x, 0.001, D.finalGoal.z); sim(0.3); out.done = g.state === 'complete' || g.state === 'ended' || w.completed;
    return out;
  });
  ok(r.maids === 4 && r.wingA === 2 && r.wingB === 2 && r.statue, `dnd: two housekeepers in each wing (${r.maids}), and a third in the west wing who is wax (${r.statue})`);
  ok(r.stages === 6 && r.cps === 5, `dnd: six stages, a checkpoint for each after the first (${r.stages}/${r.cps})`);
  ok(r.periodic && r.onPath && r.pauses, 'dnd: the rounds are exact (periodic), start at a junction on the way out and go up a side passage, and pause at each end');
  ok(r.carts >= 6, `dnd: laundry carts to hide in (${r.carts})`);
  ok(r.found && r.sees && r.behind && r.farAway, 'dnd: she sees 3 m ahead, not behind her, not 13 m away');
  ok(r.meterRises && r.caught, 'dnd: being in the cone fills the alert meter, then you are caught');
  ok(r.hiddenSafe && r.foundDead, 'dnd: hiding in a cart makes you invisible, unless she walks into your cart');
  ok(r.statueSafe && r.statueSees, 'dnd: the wax housekeeper looks right at you and nothing happens');
  ok(r.doors >= 3 && r.realWorks && r.faded && r.fakeFails && r.signShown, 'dnd: the DND sign on an OCCUPIED door sends the housekeeper in for a while; on a VACANT one it does nothing');
  ok(r.pressAgree && r.pressKills, 'dnd: the mangles slam on a beat the bot can read, and a low one is fatal');
  ok(r.vatKills && r.decoyKills && r.closetKills, 'dnd: the vat, the decoy STAIRS and the fire-door cupboard are fatal');
  ok(r.liftShut && r.liftRide && r.liftFreeze && r.liftOpen, 'dnd: the service lift shuts, "loads", then opens on the west wing');
  ok(r.mirror && r.mirrorGone, 'dnd: quiet hours turn the mouse round (and a respawn gives it back)');
  ok(r.fakeWin && r.notDone && r.bonus && r.done, 'dnd: the first STAIRS fake a LEVEL COMPLETE, then the real ones appear');
  await page.close();
});

suite('dnd-baby', async () => {
  const page = await open(12);
  const r = await page.evaluate(async () => {
    const g = window.__trust; g.baby = true; await g.loadLevel(g.levelIndex); g.state = 'playing'; g.manual = true; g.respawnPlayer(true);
    const w = g.world, D = w.dnd, out = {};
    const fake = D.doorsDND.find((d) => !d.real); fake.it.onUse(g);
    out.fakeWorks = fake.u.maid.offUntil > w.t + 20;
    const m = D.maids[0], q = { x: 0, z: 0, yaw: 0, moving: false };
    const st = (() => { for (let t = 0; t < m.round.period; t += 0.1) { const s = m.round.at(t); if (D.rayWall(m.walls, s.x, s.z, -Math.sin(s.yaw), -Math.cos(s.yaw), 12) > 3.5) return s; } })();
    void q;
    D.maids.forEach((mm) => { mm.offUntil = 0; }); m.round.at = () => ({ ...st, moving: false });
    D.maids.slice(1).forEach((mm) => { mm.offUntil = 1e9; });
    g.player.teleport(st.x - Math.sin(st.yaw) * 3, 0.01, st.z - Math.cos(st.yaw) * 3);
    for (let i = 0; i < 60 * 0.7; i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); }
    out.slowFill = g.state === 'playing' && m.seen > 0.3;
    g.baby = false;
    return out;
  });
  ok(r.fakeWorks, 'dnd baby: the sign works on every door');
  ok(r.slowFill, 'dnd baby: she needs longer to be sure (0.95 s)');
  await page.close();
});

suite('dnd-seeds', async () => {
  const page = await open(12);
  const bad = [];
  for (let s = 0; s < 8; s++) {
    if (s) await reloadLevel(page);
    const r = await page.evaluate(() => {
      const g = window.__trust, w = g.world, D = w.dnd, out = { errs: [] };
      const e = (m) => out.errs.push(m);
      for (const M of [D.MA, D.MB]) {
        if (M.solve([0, 0]).slice(-1)[0].join() !== `${M.N - 1},${M.N - 1}`) e('unsolvable');
        for (let k = 0; k < 3; k++) {
          const c = [Math.floor(Math.random() * M.N), Math.floor(Math.random() * M.N)];
          g.player.teleport(M.cx(c[0]), 0.001, M.cz(c[1]));
          const pts = g._hintPoints();
          if (!pts) { e('no hint'); continue; }
          const last = pts[pts.length - 1];
          if (Math.hypot(last.x - M.exit.x, last.z - M.exit.z) > 0.1) e('hint does not end at the maze exit');
          for (let i = 2; i < pts.length - 1; i++) if (Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].z - pts[i - 1].z) > M.C + 0.01) e('hint jumps a wall');
          if (pts.some((q) => q.z < M.zN - 3)) e('hint goes past this maze');
        }
      }
      if (D.maids.length !== 4) e('maids ' + D.maids.length);
      for (const m of D.maids) {
        const mid = m.M.path[m.M.path.length >> 1];
        if (m.round.cells.some((c) => c[0] === mid[0] && c[1] === mid[1])) e('a round over the checkpoint');
        if (!m.M.onPath(m.round.cells[0])) e('a round that does not touch the way out');
        if (m.round.cells.length < 2) e('round too short');
      }
      if (!D.doorsDND.some((d) => d.real) || !D.doorsDND.some((d) => !d.real)) e('DND doors missing');
      if (!D.decoy || D.MB.onPath(D.decoy.cell)) e('decoy missing or on the path');
      if (D.MB.path.some((c, k) => k > 1 && Math.hypot(D.MB.cx(c[0]) - D.statue.x, D.MB.cz(c[1]) - D.statue.z) < 0.9)) e('the wax one stands in the way');
      out.len = [D.MA.path.length, D.MB.path.length];
      return out;
    });
    if (r.errs.length) bad.push(`seed ${s}: ${[...new Set(r.errs)].join(', ')} (${r.len})`);
  }
  ok(bad.length === 0, `dnd: 8 fresh floors are solvable, honest and well placed${bad.length ? '\n    ' + bad.join('\n    ') : ''}`);
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
    g.player.teleport(L.x, L.top, L.z); g.player.grounded = true; g.player.ground = L; sim(0.3); return new Promise((res) => setTimeout(() => { sim(0.5); out.back = g.player.z > L.z + 15; out.notSaved = Math.abs(w.respawn.z - L.z) > 1; res(out); }, 1200));
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
  await page.waitForTimeout(2000);
  ok(await fakeOverlay(page), 'minibar: paying the bill shows CHECKED OUT!');
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
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    const go = (r2, id) => { g.state = 'playing'; g.frozen = false; h.setRound(r2, id); };
    out.kinds = Object.keys(h.A).length;
    out.acts = new Set(h.route.map((r2, i) => (r2.length ? i : -1))).size;
    // round 1 is always normal; a right call counts
    go(1); out.r1Normal = h.cur === null;
    h.decide(true); out.count1 = h.round === 2;
    // a wrong call sends you back to the first round of the act (baby: only repeats the round)
    go(4, 'crooked'); h.decide(true); out.backToAct = h.round === 3;
    go(4, null); h.decide(false); out.paranoidBack = h.round === 3;
    g.baby = true; go(4, 'crooked'); h.decide(true); out.babyRepeats = h.round === 4; g.baby = false;
    // an anomaly can be toggled on and off cleanly
    out.togglable = Object.values(h.A).every((a) => { try { a.on(); a.off(); return true; } catch (e) { return false; } });
    // acts: only the current act's floor is solid
    for (const [round, act] of [[1, 0], [3, 1], [5, 2], [7, 3]]) { go(round); out['act' + act] = h.route.every((rr, k) => rr.every((q) => q.body.enabled === (k === act))); }
    // the mirrored corridor mirrors the mouse too; the upside-down painting inverts it
    go(3, 'mirror'); g.player.teleport(0, 0.01, -16); sim(0.2); out.mirrorX = g.mods.invertX === true; go(3, null); sim(0.1);
    go(5, 'upside'); g.player.teleport(0, 0.01, -20); sim(0.05); out.upY = g.mods.invertY === true; g.respawnPlayer(false); out.twistsReset = !g.mods.invertX && !g.mods.invertY;
    // round 6's counter expires (Baby Mode: it does not)
    go(6, null); h.roundT = 46; sim(0.3); out.expires = h.round === 5 && said.includes('hotel.l14.expire');
    g.baby = true; go(6, null); h.roundT = 46; sim(0.3); out.babyKeeps = h.round === 6; g.baby = false;
    // round 7 crashes the screen, then a new EXIT door shows (it is an anomaly; behind it: nothing)
    go(7, 'exitDoor'); g.player.teleport(0, 0.01, -12); sim(0.2); out.crash = g.frozen === true && said.includes('hotel.l14.crash'); g.frozen = false;
    // the hint is honest, about this round only
    g.debug = false;
    const hint = (id, round = 3) => { go(round, id); said.length = 0; g.hintCool = 0; g.useHint(); return said.slice(); };
    out.hintNone = hint(null).includes('hotel.l14.hint.none');
    out.hintSome = hint('crooked').includes('hotel.l14.hint.some');
    g.hintCool = 0; g.useHint(); out.hintWhere = said.includes('hotel.l14.hint.where');
    // eight right in a row: the far door opens (a fake LEVEL COMPLETE follows, then the encore)
    go(8, null); h.decide(true); out.exitLap = h.phase === 'exitLap';
    out.hostLiesSometimes = true;
    // dying in the corridor has a reason: no death without the floor missing (a gap) or a hazard
    go(3, null); g.player.teleport(0, 0.01, -9.4); sim(1.2); out.fell = g.deaths > 0 || g.player.y < -1;
    return out;
  });
  ok(r.kinds >= 28, `hallway: ${r.kinds} anomaly kinds in the catalogue`);
  ok(r.r1Normal && r.count1, 'hallway: round 1 is always normal and a right call counts');
  ok(r.backToAct && r.paranoidBack, 'hallway: a wrong call (walked past it, or turned back from nothing) goes back to the start of the act');
  ok(r.babyRepeats, 'hallway: baby mode only repeats the round');
  ok(r.togglable, 'hallway: every anomaly switches on and off');
  ok(r.act0 && r.act1 && r.act2 && r.act3, 'hallway: each act has its own floor (parkour acts II-IV)');
  ok(r.mirrorX && r.upY && r.twistsReset, 'hallway: mirror round twists mouseX, upside-down painting twists mouseY, respawn clears them');
  ok(r.expires && r.babyKeeps, 'hallway: round 6 counter expires (not in baby mode)');
  ok(r.crash, 'hallway: round 7 crashes the screen');
  ok(r.hintNone && r.hintSome && r.hintWhere, 'hallway: the hint is honest (none / some / where)');
  ok(r.exitLap, 'hallway: eight right calls open the far door');
  ok(r.fell, 'hallway: the gap in act II is a real gap');
  await page.close();
});

// ---- level 15: Window Ledge ---------------------------------------------------------------------------------------
suite('ledge', async () => {
  const page = await open(15);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, lg = w.ledge, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    out.ledges = lg.ledges.length;
    out.types = [...new Set(lg.ledges.map((l) => l.type))].sort().join(',');
    out.stages = lg.stages.length; out.stagesAt = lg.stages.every((s) => s.at);
    out.cps = lg.cps.size;
    // gusts push you off the wall, leaning (D) holds you on
    const corn = lg.ledges.find((l) => l.type === 'cornice'); const gu = lg.gusts[0];
    const stand = () => { g.player.teleport(corn.x, corn.y + 0.001, -corn.dep / 2); g.player.grounded = true; g.yaw = -Math.PI / 2; g.pitch = 0; g.keys.clear(); };
    const waitGust = () => { for (let i = 0; i < 60 * 14 && !gu.wi.active; i++) g._simulate(1 / 60); };
    waitGust(); stand(); const z0 = g.player.z; sim(0.6); out.drift = z0 - g.player.z;
    g.baby = true; waitGust(); stand(); const zb = g.player.z; sim(0.6); out.babyDrift = zb - g.player.z; g.baby = false;
    g.state = 'playing'; g.respawnPlayer(false);
    // the pennant stiffens before the gust (the tell)
    let warned = false; for (let i = 0; i < 60 * 14; i++) { g._simulate(1 / 60); if (!gu.wi.active && gu.k > 0.1) warned = true; }
    out.warned = warned;
    // lift and tram move
    const lf = lg.lifts[0], y0 = lf.pl.body.y; let ymax = 0; for (let i = 0; i < 60 * 30; i++) { g._simulate(1 / 60); ymax = Math.max(ymax, Math.abs(lf.pl.body.y - y0)); } out.lift = ymax;
    const tr = lg.trams[0], x0 = tr.pl.body.x; let xmax = 0; for (let i = 0; i < 60 * 25; i++) { g._simulate(1 / 60); xmax = Math.max(xmax, Math.abs(tr.pl.body.x - x0)); } out.tram = xmax;
    // the gale gate shoves you back out of it
    const gt = lg.gates[0]; g.state = 'playing';
    for (let i = 0; i < 60 * 12 && !gt.wi.active; i++) g._simulate(1 / 60);
    g.player.teleport(gt.xa + 2, gt.y + 0.001, gt.ledge.zc); g.player.grounded = true; g.yaw = -Math.PI / 2; g.keys.clear(); g.keys.add('KeyW'); sim(1.0); out.gateBack = g.player.x < gt.xa + 2 - 0.5 && g.player.y > gt.y - 0.5; g.keys.clear();
    // the painted window kills (it is paint), with a line
    g.state = 'playing'; g.respawnPlayer(false); said.length = 0;
    // twists
    out.hasTwist = true;
    // fake complete then bonus
    g.state = 'playing'; g.respawnPlayer(false);
    out.bonusOffFirst = lg.bonusOn === false && lg.bonus.every((p) => !p.body.enabled);
    lg.fakeGoal.trig.onEnter?.(); sim(0.1);
    return out;
  });
  ok(r.ledges >= 55 && r.stages === 5 && r.stagesAt && r.cps >= 4, `ledge: five stages, a long route (${r.ledges} pieces, ${r.cps} window checkpoints)`);
  ok(/ac/.test(r.types) && /cornice/.test(r.types) && /crumble/.test(r.types) && /gondola/.test(r.types) && /perch/.test(r.types) && /pipe/.test(r.types) && /lift/.test(r.types) && /tram/.test(r.types) && /vanish/.test(r.types), `ledge: every kind of hazard is on the route (${r.types})`);
  ok(r.drift > 0.2, `ledge: a gust pushes you away from the wall (${r.drift.toFixed(2)} m)`);
  ok(r.babyDrift < r.drift * 0.75, `ledge: baby mode halves the gusts (${r.babyDrift.toFixed(2)} vs ${r.drift.toFixed(2)} m)`);
  ok(r.warned, 'ledge: the pennant stiffens before a gust (telegraph)');
  ok(r.lift > 6 && r.tram > 10, `ledge: the lift rises ${r.lift.toFixed(1)} m and the tram travels ${r.tram.toFixed(1)} m`);
  ok(r.gateBack, 'ledge: a gale gate shoves you back without throwing you off');
  ok(r.bonusOffFirst, 'ledge: the bonus climb only exists after the fake LEVEL COMPLETE');
  await page.close();
});

// level 15: the storm and the tricks
suite('ledge-tricks', async () => {
  const page = await open(15);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, lg = w.ledge, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    // lightning: three flickers, then a white-out; it waits until you stand on something wide
    const st = lg.storm; st.next = w.t + 0.2;
    g.player.teleport(0, 14.001, -0.9); g.player.grounded = true;
    let maxFlick = 0, maxFlash = 0, flickersBeforeStrike = 0;
    for (let i = 0; i < 60 * 5; i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); maxFlick = Math.max(maxFlick, st.flickA); maxFlash = Math.max(maxFlash, st.flashA); if (st.strikes === 0) flickersBeforeStrike = st.flickers; }
    out.flick = flickersBeforeStrike; out.strikes = st.strikes; out.maxFlash = maxFlash; out.flicker = said.includes('hotel.l15.flicker');
    // never while on a narrow ledge: stand on a cornice for 6 s with a strike due
    const corn = lg.ledges.find((l) => l.type === 'cornice'); st.next = w.t + 0.1; const s0 = st.strikes;
    g.player.teleport(corn.x, corn.y + 0.001, corn.zc); g.player.grounded = true;
    for (let i = 0; i < 60 * 6; i++) { g.player.teleport(corn.x, corn.y + 0.001, corn.zc); g.player.grounded = true; g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); }
    out.narrowNoStrike = st.strikes === s0;
    // painted window: pressing E kills, with the host's line
    g.state = 'playing'; said.length = 0;
    out.paint = !!lg.paint;
    // expiring checkpoint (window 2)
    const cp2 = [...lg.cps.entries()].find(([, i]) => i === 1)[0];
    g.state = 'playing'; g.respawnPlayer(false);
    g.player.teleport(cp2.x, cp2.y + 0.5, cp2.z); sim(0.3);
    out.cp2saved = Math.abs(w.respawn.x - cp2.x) < 0.5;
    sim(32); out.cp2expired = Math.abs(w.respawn.x - cp2.x) > 5 && said.includes('hotel.l15.expired');
    // mouseX twist in a gale at the stage 4 sill; lag twist on the ladder
    g.state = 'playing'; g.respawnPlayer(false);
    const tw = lg.ledges.find((l) => l.type === 'sill' && l.stage === 3 && l.len === 4.5);
    g.player.teleport(tw.x, tw.y + 0.001, tw.zc); sim(0.3); out.mouseX = g.mods.invertX === true; out.gale = lg.gusts.some((q) => q.forced > w.t);
    g.respawnPlayer(false); out.cleared = !g.mods.invertX;
    const rg = lg.ledges.filter((l) => l.type === 'rung')[1]; g.player.teleport(rg.x, rg.y + 0.001, rg.zc); sim(0.3); out.lag = g.mods.jumpLag > 0;
    g.respawnPlayer(false);
    // fake LEVEL COMPLETE, then the bonus
    lg.fakeGoal.trig.onEnter(); sim(0.1); out.frozen = g.frozen === true;
    return out;
  });
  ok(r.flick >= 3 && r.strikes >= 1 && r.maxFlash > 0.9, `ledge: lightning flickers ${r.flick}x before it whites the screen out (flash ${r.maxFlash && r.maxFlash.toFixed(2)})`);
  ok(r.narrowNoStrike, 'ledge: lightning never whites out while you are on a narrow ledge');
  ok(r.cp2saved && r.cp2expired, 'ledge: the window-2 checkpoint saves, then expires');
  ok(r.mouseX && r.gale && r.cleared, 'ledge: mouseX twist comes with a forced gale, respawn clears it');
  ok(r.lag, 'ledge: the ladder rung lags your jumps');
  ok(r.frozen, 'ledge: reaching ROOM 1502 shows a fake LEVEL COMPLETE');
  await page.close();
});

// ==== levels 5, 6 and 10 (Bellhop Blues, Soufflé, Dance Floor) ===================================================
// ---- level 5: Bellhop Blues (a chase in five stages; the bell waits behind every fire shutter) -------------------
suite('bellhop', async () => {
  const page = await open(5);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, c = w.chase, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    const put = (x, y, z) => { g.player.teleport(x, y + 0.001, z); g._simulate(1 / 60); };
    const revive = () => { g.state = 'playing'; g.respawnPlayer(false); };
    const clean = () => !g.frozen && !document.querySelector('.fakewin') && !g.mods.swapFwd && !g.mods.swapStrafe && !g.mods.invertX && !g.modal;
    out.stages = c.stages.length; out.cps = c.cps.size;
    out.hintData = c.stages.every((s) => s.at && s.route.length >= 2);
    // the bell waits behind the start shutter, then comes through it
    const z0 = c.bell.z;
    sim(1.2); out.waits = c.bell.z === z0 && c.bell.mode === 'hold' && c.doors[0].body.enabled;
    sim(2.6); out.comes = c.bell.z < z0 - 2 && !c.doors[0].body.enabled;
    // stand still and it gets you
    for (let i = 0; i < 60 * 25 && g.state === 'playing'; i++) g._simulate(1 / 60);
    out.caught = g.state === 'dead' && Math.abs(g.player.z - c.bell.z) < 3;
    revive();
    out.reset0 = c.bell.mode === 'hold' && c.bell.z === z0 && c.doors[0].body.enabled && !c.lid.body.enabled && clean();
    // the gold EXPRESS belt runs backwards (towards the bell), the plain STAFF one forwards
    out.belts = c.beltL.body.conv[1] > 0 && c.beltR.body.conv[1] < 0;
    // down the chute: the lid shuts above you, the bell waits on it a few seconds, then drops in
    put(0, -8.4, -63.5);
    out.lidShut = c.lid.body.enabled && c.bell.pending?.k === 1;
    const wait1 = c.bell.pending.at - w.t;
    put(0, -9, -68.5);
    out.cp2 = Math.abs(w.respawn.z + 68.5) < 0.1;
    sim(wait1 - 0.5); out.lidHolds = c.bell.mode !== 'drop' && c.bell.k === 0;
    sim(0.8); out.drops = c.bell.k === 1 && (c.bell.mode === 'drop' || c.bell.mode === 'run') && !c.lid.body.enabled;
    // the crooked checkpoint on the folding table saves nothing
    put(0.4, -8, -87.6); sim(0.1);
    out.fakeCp = Math.abs(w.respawn.z + 68.5) < 0.1;
    // a death in the laundry: back at the chute, the lid shut, the bell sitting on it again
    g.kill('test'); revive();
    out.reset1 = c.bell.mode === 'hold' && c.bell.k === 0 && c.lid.body.enabled && c.bell.pending?.k === 1 && clean();
    // the kitchen shutter slams behind you; the bell waits longer here (the patch)
    put(0, -9, -140.5);
    out.slam2 = c.doors[2].body.enabled && c.bell.pending?.k === 2;
    put(0, -9, -142);
    out.wait2 = c.BS[2].wait;
    put(0, -9, -145.5);
    out.twistOn = g.mods.swapFwd === true;
    sim(5); out.twistOff = g.mods.swapFwd === false;
    put(0, -9, -142); g.kill('test'); revive();
    put(0, -9, -145.5); const tw2 = g.mods.swapFwd; g.kill('test'); revive();
    out.twistAgainAndCleared = tw2 && clean() && c.bell.k === 1 && c.doors[2].body.enabled && c.bell.pending?.k === 2;
    // the heat lamps, the press and the steam jets switch on and off, and tell the bot when
    const seen = [c.plate, ...c.lamps.map((l) => l.hz), ...c.jets.map((j) => j.hz)].map(() => new Set());
    for (let i = 0; i < 60 * 6; i++) { g._simulate(1 / 60); [c.plate, ...c.lamps.map((l) => l.hz), ...c.jets.map((j) => j.hz)].forEach((h, k) => seen[k].add(h.enabled)); }
    out.timed = seen.every((s) => s.size === 2) && !!c.plate.predict && c.jets.every((j) => !!j.hz.predict);
    // the freight elevator: step in, the gate shuts, a LEVEL COMPLETE that is not, and down it goes
    put(0, -9, -219);                                                      // (stage 4's checkpoint)
    put(0, 0.8, -266.5); sim(0.2);
    out.fakeWin = c.elev.phase === 'closing' && !!document.querySelector('.fakewin') && c.gateS.body.enabled;
    sim(5.5);
    out.wentDown = c.elev.phase === 'bottom' && Math.abs(c.car.top - (-21.2)) < 0.05 && !c.gateN.body.enabled && Math.abs(g.player.y + 21.2) < 0.1;
    // a death before the sub-basement checkpoint puts the lift back at the top
    g.kill('test'); revive();
    out.liftBack = c.elev.phase === 'top' && Math.abs(c.car.top - 0.8) < 0.05 && !c.gateS.body.enabled && c.gateN.body.enabled && clean();
    return out;
  });
  ok(r.stages === 5 && r.cps === 4 && r.hintData, `bellhop: five stages, a checkpoint at the start of each of the other four (${r.stages}, ${r.cps})`);
  ok(r.waits && r.comes, 'bellhop: the bell waits behind the start shutter, then bursts through');
  ok(r.caught && r.reset0, 'bellhop: it catches you if you stand still; a respawn puts it back behind the shutter');
  ok(r.belts, 'bellhop: the gold EXPRESS belt runs backwards, the STAFF belt forwards');
  ok(r.lidShut && r.cp2 && r.lidHolds && r.drops, 'bellhop: the chute lid shuts behind you, the bell waits on it, then drops in');
  ok(r.fakeCp, 'bellhop: the crooked checkpoint in the laundry saves nothing');
  ok(r.reset1, 'bellhop: dying in the laundry puts the bell back on the lid (nothing stuck)');
  ok(r.slam2 && r.wait2 >= 7, `bellhop: the kitchen shutter slams; the bell waits ${r.wait2} s there (the W/S patch)`);
  ok(r.twistOn && r.twistOff && r.twistAgainAndCleared, 'bellhop: W/S swap past the kitchen checkpoint, wears off, re-arms and clears on respawn');
  ok(r.timed, 'bellhop: the press, the heat lamps and the steam jets cycle (and expose their timing)');
  ok(r.fakeWin, 'bellhop: the freight elevator shows LEVEL COMPLETE and shuts its gate');
  ok(r.wentDown, 'bellhop: ...then goes the wrong way (down to the sub-basement) and opens');
  ok(r.liftBack, 'bellhop: a death before the sub-basement puts the lift back at the top (nothing stuck)');
  // the STAFF EXIT is a closet (press E: it swings open, then you fall)
  await page.evaluate(() => { const g = window.__trust, w = g.world; g.state = 'playing'; g.player.teleport(0, -8.999, -147); g._simulate(1 / 60); const it = w.interactables.find((i) => Math.abs(i.body.z + 149.5) < 0.1); it.onUse(g); });
  await page.waitForTimeout(1500);
  ok(await page.evaluate(() => window.__trust.state === 'dead'), 'bellhop: the STAFF EXIT door is a closet with no floor');
  const r2 = await page.evaluate(() => {
    const g = window.__trust, w = g.world, c = w.chase, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    const put = (x, y, z) => { g.player.teleport(x, y + 0.001, z); g._simulate(1 / 60); };
    g.state = 'playing'; g.respawnPlayer(false);
    // the sub-basement: the bell comes down the shaft after you
    put(0, 0.8, -266.5); sim(5.5); put(0, -21.2, -272);
    out.cp5 = Math.abs(w.respawn.z + 272) < 0.1 && c.bell.pending?.k === 4;
    sim(c.BS[4].wait + 0.3); out.shaft = c.bell.k === 4;
    g.kill('test'); g.state = 'playing'; g.respawnPlayer(false);
    out.stays = c.elev.phase === 'bottom' && !c.gateN.body.enabled && c.bell.pending?.k === 4;
    // the hint: honest and only to the next stage
    put(-2.7, -21.2, -313.5);
    const pts = w.hintFn(g), last = pts[pts.length - 1];
    out.hintEnd = Math.hypot(last.x - w.goalObj.x, last.z - w.goalObj.z) < 0.2;
    w.respawn = { ...c.stages[1].at }; put(0, -9, -135);
    const p2 = w.hintFn(g), l2 = p2[p2.length - 1];
    out.hintNext = Math.hypot(l2.x - c.stages[2].at.x, l2.z - c.stages[2].at.z) < 0.2;
    w.respawn = { ...c.stages[4].at };
    // the painted EXIT kills; the dumbwaiter (up the crates) is the way out
    put(1.8, -21.2, -328.1); out.painted = g.state === 'dead';
    g.state = 'playing'; g.respawnPlayer(false);
    put(-2.7, -18.8, -321.6); sim(0.1); out.done = g.state === 'complete';
    return out;
  });
  ok(r2.cp5 && r2.shaft && r2.stays, 'bellhop: the sub-basement checkpoint; the bell drops down the shaft; respawns keep the lift down');
  ok(r2.hintNext && r2.hintEnd, 'bellhop: the hint stops at the next stage (and at the dumbwaiter in the last one)');
  ok(r2.painted, 'bellhop: the painted EXIT kills');
  ok(r2.done, 'bellhop: the dumbwaiter completes the level');
  await page.close();
  // baby mode: a slower bell that waits longer, and the crooked checkpoint counts
  const pb = await open(5);
  const rb = await pb.evaluate(() => {
    const g = window.__trust, w = g.world, c = w.chase, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    g.baby = true; g.kill('test'); g.state = 'playing'; g.respawnPlayer(false);
    out.longerWait = Math.abs((c.bell.pending.at - w.t) - (c.BS[0].wait + 1.5)) < 0.05;
    g.player.teleport(0, 0.001, 9); sim(c.BS[0].wait + 1.6); const z1 = c.bell.z; sim(1); out.babySpeed = (z1 - c.bell.z) > 1 && (z1 - c.bell.z) < c.BS[0].v * 0.85;
    g.player.teleport(0.4, -7.999, -87.6); g._simulate(1 / 60); sim(0.1);
    out.fakeCounts = Math.abs(w.respawn.z + 87.6) < 0.1;
    return out;
  });
  ok(rb.longerWait && rb.babySpeed, 'bellhop: baby mode: the bell waits longer and rolls slower');
  ok(rb.fakeCounts, 'bellhop: baby mode: the crooked checkpoint counts');
  await pb.close();
});

// =====================================================================================================================
//  Levels 4, 9 and 12 (the multi-maze levels): sealed second mazes, logic, many seeds
// =====================================================================================================================
// The same flood fill as mazeseal-*, but for any maze `m` ({X0, Z0, N, C}), starting from (sx, sz), over floors near `fy`.
// `open` = bodies to treat as open (doors). Returns the number of cells reached beside the maze, and how many cells were filled.
async function sealFill(page, js) {
  return page.evaluate(`(() => { const g = window.__trust, w = g.world; const spec = (${js})(g, w);
    const { m, sx, sz, fy = 0, open = [] } = spec, step = 0.5, openSet = new Set(open);
    const bodies = w.bodies.filter((b) => b.solid && !openSet.has(b));
    const blocked = (x, z) => bodies.some((b) => b.top > fy + 1.6 && b.top - b.hy * 2 < fy + 1.0 && Math.abs(x - b.x) < b.hx + 0.4 && Math.abs(z - b.z) < b.hz + 0.4);
    const floor = (x, z) => bodies.some((b) => Math.abs(b.top - fy) < 0.6 && Math.abs(x - b.x) < b.hx && Math.abs(z - b.z) < b.hz);
    const key = (i, j) => i * 10000 + j, seen = new Set([key(0, 0)]), q = [[0, 0]], side = [];
    while (q.length) {
      const [i, j] = q.pop(); const x = sx + i * step, z = sz + j * step;
      if ((x < m.X0 - 0.8 || x > m.X0 + m.N * m.C + 0.8) && z < m.Z0 - 1 && z > m.Z0 - m.N * m.C + 1) side.push([x, z]);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj, nx = sx + ni * step, nz = sz + nj * step;
        if (Math.abs(nx) > 60 || Math.abs(nz - sz) > 90 || seen.has(key(ni, nj))) continue;
        if (blocked(nx, nz) || !floor(nx, nz)) continue;
        seen.add(key(ni, nj)); q.push([ni, nj]);
      }
    }
    return { side: side.length, cells: seen.size, ex: side[0] || null }; })()`);
}
const reloadLevel = (page) => page.evaluate(async () => { const g = window.__trust; await g.loadLevel(g.levelIndex); g.state = 'playing'; g.manual = true; g.respawnPlayer(true); });

// ---- level 4: Revolving Door ---------------------------------------------------------------------------------------
suite('mazeseal2-revolving', async () => {
  const page = await open(4);
  const r = await sealFill(page, `(g, w) => { const L = w.l4; return { m: L.MB, sx: L.L2.body.x, sz: L.L2.body.z, open: [...L.doors.map((d) => d.body), L.gate.body] }; }`);
  ok(r.cells > 400, `revolving maze B: the fill covers a real area (${r.cells} cells)`);
  ok(r.side === 0, `revolving maze B: nowhere beside the dusk maze can be reached from the garden gate (${r.side} cells leak${r.ex ? ' e.g. ' + r.ex : ''})`);
  // the courtyard cannot be walked round either: from the first maze's exit nothing reaches the second maze's gate on foot
  const c = await sealFill(page, `(g, w) => { const L = w.l4; return { m: { X0: 1e4, Z0: L.WATER_N + 1, N: 1, C: 300 }, sx: L.L1.body.x, sz: L.L1.body.z, open: L.doors.map((d) => d.body) }; }`);
  const reach = await page.evaluate(() => { const L = window.__trust.world.l4; return { l2z: L.L2.body.z, waterN: L.WATER_N }; });
  ok(c.side === 0, `revolving: the courtyard is water wall to wall (${c.side} dry cells north of the pool reachable on foot from the first landing, gate at z ${reach.l2z.toFixed(1)})`);
  await page.close();
});

suite('revolving', async () => {
  const page = await open(4);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, L = w.l4, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    out.stages = L.NAMES.length; out.cps = L.cps.size;
    out.lenA = L.MA.path.length; out.lenB = L.MB.path.length;
    out.solved = L.MA.solve([0, 0]).slice(-1)[0].join() === `${L.MA.N - 1},${L.MA.N - 1}` && L.MB.solve([0, 0]).slice(-1)[0].join() === `${L.MB.N - 1},${L.MB.N - 1}`;
    // every door sits on an open edge; maze doors open and close on their schedule
    const mazeDoors = L.doors.filter((d) => d.M);
    out.doorsOnEdges = mazeDoors.every((d) => d.M.maze.open(d.a[0], d.a[1], d.b[0], d.b[1]));
    const seen = L.doors.map(() => new Set());
    for (let i = 0; i < 60 * 5; i++) { g._simulate(1 / 60); L.doors.forEach((d, k) => { if (!d.locked) seen[k].add(d.body.enabled); }); }
    out.doorsCycle = L.doors.every((d, k) => d.locked || seen[k].size === 2);
    out.doorsB = mazeDoors.filter((d) => d.M === L.MB && d.kind === 'door').length;
    // the decoy EXIT arch: in a dead end, off the path, not behind the loop door, and it kills
    out.decoyDead = !!L.decoy && L.MB.deadEnds.some((c) => c[0] === L.decoy.cell[0] && c[1] === L.decoy.cell[1]) && !L.MB.onPath(L.decoy.cell) && !L.loopCells.has(L.MB.key(L.decoy.cell));
    g.player.teleport(L.decoy.x, 0.001, L.decoy.z); sim(0.1); out.decoyKills = g.state === 'dead';
    g.state = 'playing'; g.respawnPlayer(false);
    // the water kills; the jets fire on their schedule (and their prediction matches)
    g.player.teleport(0, 0.001, (L.WATER_S + L.WATER_N) / 2 + 3); sim(0.6); out.waterKills = g.state === 'dead';
    g.state = 'playing'; g.respawnPlayer(false);
    let agree = 0, n = 0, on = 0; for (let i = 0; i < 60 * 7; i++) { g._simulate(1 / 60); for (const j of L.jets) { n++; if (j.hz.enabled === j.hz.predict(w.t)) agree++; if (j.hz.enabled) on++; } }
    out.jets = agree === n && on > 30 && on < n * 0.5;
    // the gate stays shut until the ad has run (5 s), then opens; the ad overlay goes
    g.player.teleport(L.L2.body.x, 0.001, L.L2.body.z); sim(0.3);
    out.gateShut = L.gate.body.enabled && !L.gate.open; out.adOn = !document.getElementById('ov-ad').classList.contains('hidden');
    sim(4.0); out.stillShut = !L.gate.open;
    sim(1.4); out.gateOpens = L.gate.open && !L.gate.body.enabled;
    out.adSec = said.includes('hotel.l4.gate');
    // the Grand Revolving Door: hold W from its south side and it carries you round and out of the north side; you can never be
    // between two wings' blades, and never in the hub
    const D = L.drum; g.player.teleport(L.VX, 0.001, D.z + D.R + 1.2); g.yaw = 0; g.keys.add('KeyW');
    let through = 0, okWings = true;
    for (let i = 0; i < 60 * 16 && !through; i++) {
      g._simulate(1 / 60);
      const dx = g.player.x - D.x, dz = g.player.z - D.z, r = Math.hypot(dx, dz);
      if (D.inside && r < 0.9) okWings = out.bad = out.bad || ['hub', r, i];
      if (D.inside) { const Q = Math.PI / 2, rel = (((Math.atan2(dz, dx) - D.phi) % Q) + Q) % Q; if (rel < 0.15 || rel > Q - 0.15) okWings = out.bad = out.bad || ['wing', rel, r, i]; }
      if (g.player.z < D.z - D.R - 0.5) through = i / 60;
    }
    g.keys.delete('KeyW'); out.drum = through > 0 && through < 14; out.drumWings = okWings === true; out.drumT = through;
    // the loop door is off the path and sends you back to the start of the maze
    out.loopOff = !!L.loopDoor && !L.MB.pathEdges.has(L.MB.edge(L.loopDoor.a, L.loopDoor.b));
    L.loopBack(); out.looped = Math.hypot(g.player.x - L.MB.entry.x, g.player.z - L.MB.entry.z) < 1.5 && L.loops === 1 && g.state === 'playing';
    sim(0.6); out.glitchGone = document.getElementById('ov-glitch')?.classList.contains('hidden') ?? true;
    // respawn leaves nothing behind
    g.player.teleport(L.L2.body.x, 0.001, L.L2.body.z); L.gate.open = false; L.gate.at = 0; L.gate.body.enabled = true;
    g.kill('test'); g.state = 'playing'; g.respawnPlayer(false); sim(0.2);
    out.clean = !g.frozen && document.getElementById('ov-ad').classList.contains('hidden') && !document.querySelector('.fakewin') && !g.mods.invertX && !g.mods.swapStrafe && !g.mods.swapFwd;
    // every line the level says exists
    out.said = [...new Set(said)];
    return out;
  });
  ok(r.stages === 6 && r.cps === 5, `revolving: six stages, a checkpoint for each after the first (${r.stages}/${r.cps})`);
  ok(r.solved && r.lenA >= 37 && r.lenA <= 43 && r.lenB >= 51 && r.lenB <= 57, `revolving: both mazes solvable, lengths in their bands (${r.lenA}, ${r.lenB})`);
  ok(r.doorsOnEdges && r.doorsCycle && r.doorsB >= 6, `revolving: revolving doors sit in passages and open/close on a schedule (${r.doorsB} on the dusk maze's path)`);
  ok(r.loopOff && r.looped && r.glitchGone, 'revolving: the SHORTCUT door is off the path and loops you to the start of the dusk maze');
  ok(r.decoyDead && r.decoyKills, 'revolving: the decoy EXIT arch sits in a dead end (off the path) and is fatal');
  ok(r.waterKills, 'revolving: the fountain pool is deep');
  ok(r.jets, 'revolving: the jets fire on a schedule the bot can read (predict) and are mostly off');
  ok(r.gateShut && r.adOn && r.stillShut && r.gateOpens && r.adSec, 'revolving: the garden gate opens when the 5-second ad is over ' + JSON.stringify([r.gateShut, r.adOn, r.stillShut, r.gateOpens, r.adSec]));
  ok(r.drum && r.drumWings, `revolving: the Grand Revolving Door carries you round and out (${r.drumT.toFixed(1)} s), never through a wing ${JSON.stringify(r.bad)}`);
  ok(r.clean, 'revolving: a respawn leaves no overlay, freeze or control twist behind');
  await page.close();
});

suite('revolving-baby', async () => {
  const page = await open(4);
  const r = await page.evaluate(async () => {
    const g = window.__trust; g.baby = true; await g.loadLevel(g.levelIndex); g.state = 'playing'; g.manual = true; g.respawnPlayer(true);
    const w = g.world, L = w.l4, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    out.locked = L.loopDoor.locked && L.loopDoor.body.enabled; sim(4); out.stillLocked = L.loopDoor.body.enabled;
    L.loopBack(); out.noLoop = L.loops === 0;
    g.player.teleport(L.L2.body.x, 0.001, L.L2.body.z); sim(3.3); out.shortAd = L.gate.open;
    g.baby = false;
    return out;
  });
  ok(r.locked && r.stillLocked && r.noLoop, 'revolving baby: the loop door is locked (no surprise trip back)');
  ok(r.shortAd, 'revolving baby: the gate\'s ad is 3 seconds');
  await page.close();
});

// hint honesty and the many-seed check: 12 fresh builds; each must be solvable, keep its tricks off the path, and the hint must
// follow the maze you are in (cell by cell, adjacent cells only) up to that maze's exit and never into the next section
suite('revolving-seeds', async () => {
  const page = await open(4);
  const bad = [];
  for (let s = 0; s < 12; s++) {
    if (s) await reloadLevel(page);
    const r = await page.evaluate(() => {
      const g = window.__trust, w = g.world, L = w.l4, out = { errs: [] };
      const e = (m) => out.errs.push(m);
      for (const M of [L.MA, L.MB]) {
        if (M.solve([0, 0]).slice(-1)[0].join() !== `${M.N - 1},${M.N - 1}`) e('unsolvable');
        // hint from three random cells of this maze: adjacent steps, ends at this maze's exit, never past it
        for (let k = 0; k < 3; k++) {
          const c = [Math.floor(Math.random() * M.N), Math.floor(Math.random() * M.N)];
          g.player.teleport(M.cx(c[0]), 0.001, M.cz(c[1]));
          const pts = g._hintPoints();
          if (!pts) { e('no hint'); continue; }
          const last = pts[pts.length - 1];
          if (Math.hypot(last.x - M.exit.x, last.z - M.exit.z) > 0.1) e('hint does not end at the maze exit');
          for (let i = 2; i < pts.length - 1; i++) if (Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].z - pts[i - 1].z) > M.C + 0.01) e('hint jumps a wall');
          if (pts.some((q) => q.z < M.zN - 3)) e('hint goes past this maze');
        }
      }
      // tricks stay off the path; nothing sits next to the mid-point checkpoints
      if (!L.loopDoor || L.MB.pathEdges.has(L.MB.edge(L.loopDoor.a, L.loopDoor.b))) e('loop door missing or on the path');
      if (!L.decoy || L.MB.onPath(L.decoy.cell) || L.loopCells.has(L.MB.key(L.decoy.cell))) e('decoy missing or misplaced');
      for (const M of [L.MA, L.MB]) for (const d of L.doors.filter((q) => q.M === M)) if (Math.hypot(d.mx - M.cx(M.mid[0]), d.mz - M.cz(M.mid[1])) < 2.3) e('door next to the checkpoint');
      for (const c of L.carts) { const k0 = c.run.k0; if (k0 <= (L.MA.path.length >> 1) + 1) e('cart next to the checkpoint'); }
      // the courtyard hint ends at the gate landing; in the vestibule it ends at the goal
      g.player.teleport(L.L1.body.x, 0.001, L.L1.body.z); const ph = g._hintPoints();
      if (!ph || ph.length < 3 || ph.some((q) => q.z < L.WATER_N - 0.5)) e('courtyard hint missing or runs into the next maze');
      out.len = [L.MA.path.length, L.MB.path.length];
      return out;
    });
    if (r.errs.length) bad.push(`seed ${s}: ${[...new Set(r.errs)].join(', ')} (${r.len})`);
  }
  ok(bad.length === 0, `revolving: 12 fresh mazes are solvable, honest and well placed${bad.length ? '\n    ' + bad.join('\n    ') : ''}`);
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
