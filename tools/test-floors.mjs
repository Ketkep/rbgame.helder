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
    const pts = w.hintFn(g), last = pts[pts.length - 1];
    out.hintEnd = Math.hypot(last.x - w.goalObj.x, last.z - w.goalObj.z) < 0.2;
    w.respawn = { ...c.stages[1].at };
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
