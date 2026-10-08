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

// ---- level 7: Trivia Night ------------------------------------------------------------------------------------
suite('trivia', async () => {
  const page = await open(7);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, qz = w.quiz, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    const stand = (pad) => { const b = pad.plat.body; g.player.teleport(b.x, b.top + 0.001, b.z); g.player.grounded = true; g.player.ground = b; };
    out.rounds = qz.stages.length; out.pads = qz.stages.map((s) => s.pads.length).join(',');
    // round 2: the host's number is wrong; round 6 asks for exactly that letter
    const s2 = qz.stages[1], s6 = qz.stages[5];
    out.lieIsWrong = !!s2.lieLetter && s2.wrongPads.some((p) => p.letter === s2.lieLetter);
    out.finalAsksForLie = s6.correctPad.letter === s2.lieLetter && s6.correctPad.text === s2.lieLetter;
    out.lieMatches = w.trivia.lieLetter === s2.lieLetter;
    // round 3: the pads slide
    const s3 = qz.stages[2]; const x0 = s3.pads[0].plat.body.x;
    let moved = 0; for (let i = 0; i < 60 * 6; i++) { g._simulate(1 / 60); moved = Math.max(moved, Math.abs(s3.pads[0].plat.body.x - x0)); }
    out.slides = moved > 0.8;
    // clear rounds 1-3 properly (stand on the right pad, then be on the next island)
    for (let k = 0; k < 3; k++) { stand(qz.stages[k].correctPad); sim(1.2); }
    out.cleared3 = qz.cleared === 3;
    g.player.teleport(0, 0.001, qz.islands[3].zN + 3); sim(0.4);
    // round 4: the clock starts when you are on the island, runs out and takes the pads away, then they come back
    const s4 = qz.stages[3], tm = s4.timer;
    out.clockStarted = tm.started;
    sim(13); out.padsGone = s4.pads.every((p) => p.state === 'gone'); out.downT = tm.downT > 0;
    sim(4); out.padsBack = s4.pads.every((p) => p.state === 'idle' && p.plat.body.enabled);
    // round 5 has four answers
    out.fourPads = qz.stages[4].pads.length === 4;
    return out;
  });
  ok(r.rounds === 6 && r.pads === '3,3,3,3,4,3', `trivia: six rounds with 3/3/3/3/4/3 answers (${r.pads})`);
  ok(r.lieIsWrong && r.lieMatches, 'trivia: in round 2 the host picks a WRONG letter');
  ok(r.finalAsksForLie, 'trivia: the final round\'s right answer is the letter the host lied with');
  ok(r.slides, 'trivia: round 3 pads slide');
  ok(r.cleared3, 'trivia: rounds 1-3 clear in order');
  ok(r.clockStarted && r.padsGone && r.downT, 'trivia: round 4: the 12-second clock removes the pads at zero');
  ok(r.padsBack, 'trivia: ...and they come back so you can try again');
  ok(r.fourPads, 'trivia: round 5 has four pads');
  await page.close();
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
    out.onPath = D.maids.every((m) => { let ok = true; for (let t = 0; t < m.round.period; t += 0.7) { const q = m.round.at(t); const c = m.M.cellOf(q); if (!m.M.onPath([Math.max(0, Math.min(m.M.N - 1, c[0])), Math.max(0, Math.min(m.M.N - 1, c[1]))])) ok = false; } return ok; });
    out.pauses = D.maids.every((m) => { let still = 0; for (let t = 0; t < m.round.period; t += 0.2) if (!m.round.at(t).moving) still++; return still > 8; });
    out.pockets = D.carts.filter((c) => D.maids.some((m) => m.seg.pocket && m.seg.pocket.cell[0] === c.cell[0] && m.seg.pocket.cell[1] === c.cell[1])).length;
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
  ok(r.periodic && r.onPath && r.pauses, 'dnd: the rounds are exact (periodic), follow the way out of the maze, and pause at each end');
  ok(r.carts >= 6 && r.pockets >= 3, `dnd: laundry carts to hide in (${r.carts}), most in a side passage by a round (${r.pockets})`);
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
        if (!m.seg.pocket) e('a round without a side passage');
        const mid = m.M.path[m.M.path.length >> 1];
        if (m.round.cells.some((c) => c[0] === mid[0] && c[1] === mid[1])) e('a round over the checkpoint');
        if (m.round.cells.length < 4) e('round too short');
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
  const page = await open(13);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, mb = w.minibar, qz = mb.quiz, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    out.start = mb.balance;
    out.hiddenAnswers = qz.stages.every((s) => s.pads.every((p) => !p.tag.visible));
    // opening the minibar shows the answers and costs MORE than the $4.00 on the door
    mb.openFridge(0);
    out.revealed = qz.stages[0].pads.every((p) => p.tag.visible);
    out.cost = mb.start === undefined ? 45 - mb.balance : 0;
    out.costMore = out.cost > 8;
    // a minibar you cannot afford stays shut
    mb.balance = 3; qz.stages[0].correctPad; const before = mb.opens; mb.openFridge(0);
    out.noDoubleOpen = mb.opens === before;
    mb.balance = 45;
    // hints cost too, and are declined when broke
    g.debug = false; g.hintCool = 0; const bal0 = mb.balance; g.useHint(); out.hintCharged = mb.balance < bal0 - 9;
    mb.balance = 2; g.hintCool = 0; const h0 = mb.hints; g.useHint(); out.hintDeclined = mb.hints === h0;
    // the bill: no tip, no zero tip, only 18/20/25
    mb.showBill();
    const msg = () => document.querySelector('#panel .kp-msg').textContent;
    g.modal.key({ code: 'Enter' }); out.needsTip = /select a tip/i.test(msg());
    g.modal.key({ code: 'Digit0' }); out.zeroRefused = /zero/i.test(msg());
    g.modal.key({ code: 'Digit1' });
    out.tipButtons = [...document.querySelectorAll('.bill-tip')].map((b) => b.textContent).join('|');
    out.total = document.querySelector('.bill-total b').textContent;
    return out;
  });
  ok(r.start === 45 && r.hiddenAnswers, 'minibar: you start with $45 and the answers are locked in the minibars');
  ok(r.revealed && r.costMore, `minibar: opening one reveals the answers and costs more than the $4.00 on the door (paid $${r.cost.toFixed(2)})`);
  ok(r.noDoubleOpen, 'minibar: with no money the minibar stays shut');
  ok(r.hintCharged && r.hintDeclined, 'minibar: hints cost money and are declined when you are broke');
  ok(r.needsTip && r.zeroRefused, 'minibar: the bill refuses to be paid without a tip (and refuses a zero tip)');
  ok(r.tipButtons === '1 · 18%|2 · 20%|3 · 25%', `minibar: the tip choices are 18 / 20 / 25 (${r.tipButtons})`);
  await page.evaluate(() => { window.__trust.modal.key({ code: 'Enter' }); });
  await page.waitForFunction(() => window.__trust.state === 'complete' || window.__trust.world.completed, null, { timeout: 15000 });
  ok(true, 'minibar: paying the bill completes the level');
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
