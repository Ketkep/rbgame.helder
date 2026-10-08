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

// >>> escape rooms (levels 3, 8, 11)
// ---- level 3: Lost Luggage (five rooms: office · belts · weigh-in · lost property · the pile) --------------------------------
suite('luggage', async () => {
  const page = await open(3);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, e = w.escape, out = {};
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const type = (c) => { for (const d of c) g.modal.key({ code: 'Digit' + d }); g.modal.key({ code: 'Enter' }); };
    const stand = (x, y, z) => { g.player.teleport(x, y + 0.001, z); sim(0.1); };
    // ---- stage 1: the keypad (the poster gives the order; the host's 1337 is wrong; it says GRANTED* once and means it not)
    g.debug = false; for (let i = 0; i < 3; i++) { g.hintCool = 0; g.useHint(); }
    out.hintKeys = said.filter((k) => /l3\.hint/.test(k));
    out.fakeIsNotCode = e.code !== e.fake;
    out.counts = e.pallets.every((p) => String(p.n) === e.code[e.order.indexOf(p.col)]);
    g.baby = false;
    e.useKeypad(g); type(e.fake); out.fakeDenied = !e.doorOpen && said.includes('hotel.l3.fake'); g.modal.close();
    e.useKeypad(g); type(e.code); sim(1.6); out.firstLie = !e.doorA.open && e.liedA && said.includes('hotel.l3.jk');
    g.modal?.close(); g.modal = null;
    e.useKeypad(g); type(e.code); sim(2.5); out.secondOpens = e.doorA.open;
    // ---- the mimic kills (and the other cases do not)
    const it = w.interactables.filter((i) => Math.hypot(i.body.x - e.mimic.x, i.body.z - e.mimic.z) < 0.3 && /suitcase/i.test(typeof i.label === 'function' ? i.label() : i.label))[0];
    stand(e.mimic.x, 0, e.mimic.z + 1.2); it.onUse(g); out.mimicKills = g.state === 'dead';
    g.state = 'playing'; g.respawnPlayer(false); sim(0.3);
    // ---- baby mode: the keypad tells the truth straight away
    g.baby = true; const doorBefore = e.doorA.open; g.baby = false; void doorBefore;
    // ---- stage 2: belts (a checkpoint at the entrance, an expiring one mid-way, the belt that reverses)
    out.stageCount = e.stages.defs.length;
    out.reversePhase = ['fwd', 'warn', 'back'].includes(e.rev.phase);
    e.rev.phase = 'fwd'; e.rev.t = 100; sim(0.05); out.warns = e.rev.phase === 'warn';
    sim(1.6); out.reverses = e.rev.phase === 'back' && e.BC.body.conv[1] > 0;
    sim(2.5); out.forwardAgain = e.rev.phase === 'fwd' && e.BC.body.conv[1] < 0;
    // the press hurts
    stand(0, 0, -34.9); out.pressX = 1; g.state = 'playing';
    // ---- stage 3: the scale. Size is not weight: the big case is the light one.
    const wb = e.weigh.bags, big = wb.find((b) => b.big);
    out.bigIsLight = wb.every((b) => b === big || b.kg > big.kg);
    const sorted = [...wb].sort((a, b) => b.kg - a.kg).map((b) => b.tag).join('');
    out.codeIsHeaviestFirst = sorted === e.weigh.code;
    const slotOf = (b) => e.weigh.slots.find((s) => s.bag === b);
    for (const b of wb) { e.weigh.useSlot(slotOf(b)); e.weigh.useSlot(e.weigh.scaleSlot); e.weigh.useSlot(e.weigh.scaleSlot); }
    out.weighedAll = e.weigh.weighed.size === 3;
    stand(0, 0, -64); g.state = 'playing';
    e.useKeypadB(g); type('000'); out.wrongWeigh = !e.doorB.open; g.modal.close();
    e.useKeypadB(g); type(e.weigh.code); sim(1.5); out.weighOpens = e.doorB.open;
    // ---- stage 4: the X-ray (a fake loading screen that frees you), carousel 13, the back of the duck case
    stand(0, 0, -77.2); out.xrayFreezes = g.frozen === true; for (let i = 0; i < 200 && g.frozen; i++) { /* real-time timer */ }
    // ---- the claim number is on the BACK; the tag is the host's lie
    out.claimNotTag = e.duck.back === e.claim && e.duck.tag !== e.claim;
    stand(8, 0, -106); g.state = 'playing';
    e.useKeypadC(g); type(e.duck.tag); out.tagDenied = !e.claimed && said.includes('hotel.l3.tag'); g.modal.close();
    e.useKeypadC(g); type(e.claim); sim(1.2); out.claims = e.claimed && e.gate.open;
    // ---- hint ladder: honest, current room only
    return out;
  });
  ok(r.fakeIsNotCode && r.counts, 'luggage: the host\'s 1337 is not the code; the code is the suitcase counts in the poster\'s order');
  ok(r.fakeDenied, 'luggage: typing the host\'s code is denied (and mocked)');
  ok(r.firstLie && r.secondOpens, 'luggage: the keypad says ACCESS GRANTED* once ("just kidding"), then really opens');
  ok(r.mimicKills, 'luggage: the breathing suitcase is a mimic and bites');
  ok(r.stageCount === 5, `luggage: five stages (${r.stageCount})`);
  ok(r.warns && r.reverses && r.forwardAgain, 'luggage: belt C warns (beacons), reverses, then runs forward again');
  ok(r.bigIsLight && r.codeIsHeaviestFirst, 'luggage: the big case is the light one; the release code is the tags, heaviest first');
  ok(r.weighedAll && r.wrongWeigh && r.weighOpens, 'luggage: weighing every case and entering the code opens security');
  ok(r.xrayFreezes, 'luggage: the X-ray arch is a (short) loading screen');
  ok(r.claimNotTag && r.tagDenied && r.claims, 'luggage: the claim number is on the back of the duck case, not its tag; the right number releases it');
  ok(r.hintKeys.join() === 'hotel.l3.hint1,hotel.l3.hint2,hotel.l3.hint3', `luggage: H climbs a clue ladder for the room you are in (${r.hintKeys.join()})`);
  await page.close();
});

suite('luggage-end', async () => {
  const page = await open(3);
  const r = await page.evaluate(async () => {
    const g = window.__trust, w = g.world, e = w.escape, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const stand = (x, y, z) => { g.player.teleport(x, y + 0.001, z); sim(0.1); };
    stand(0, 0, -114.6); sim(0.3); out.pileCheckpoint = Math.abs(w.respawn.z + 114.6) < 0.8;
    // the stamp runs away twice, then stays
    const pos = () => `${e.goal.x.toFixed(1)},${e.goal.z.toFixed(1)}`;
    const seen = [pos()];
    for (let k = 0; k < 4; k++) { stand(e.goal.x + 1.5, 7.4, e.goal.z + 1.5); sim(0.9); seen.push(pos()); }
    out.hopsTwice = new Set(seen).size === 3;
    return out;
  });
  ok(r.pileCheckpoint, 'luggage: there is a checkpoint at the foot of the pile');
  ok(r.hopsTwice, 'luggage: the customs stamp hops away twice, then stays');
  await page.close();
});

suite('luggage-closet', async () => {
  const page = await open(3);
  const r = await page.evaluate(async () => {
    const g = window.__trust, w = g.world, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const stand = (x, y, z) => { g.player.teleport(x, y + 0.001, z); sim(0.1); };
    const door = w.interactables.find((i) => /EXIT door|staff closet/.test(typeof i.label === 'function' ? i.label() : i.label));
    out.hasDoor = !!door;
    stand(-4.5, 7.4, -136); door.onUse(g); for (let k = 0; k < 20 && g.state !== 'dead'; k++) { await new Promise((res) => setTimeout(res, 300)); sim(0.1); } out.closetKills = g.state === 'dead';
    return out;
  });
  ok(r.hasDoor && r.closetKills, 'luggage: NOTHING TO DECLARE is a closet with no floor');
  await page.close();
});
// ---- level 8: Dinner Is Served (five rooms: dining · the pass · the pantry · the cellar · the dessert parlour) -------------------
suite('dinner', async () => {
  const page = await open(8);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, dn = w.dinner, out = {};
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    out.six = dn.cloches.length === 6 && new Set(dn.order.map((c) => c.name)).size === 6;
    out.stageCount = dn.stages.defs.length;
    // hints: a clue ladder for the room you are in
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
    g.player.teleport(0, 0.001, 0); dn.serve(wrong); sim(0.3); g.player.teleport(6, 0.001, 0); sim(2.5);
    out.dodged = g.state === 'playing';
    // serve all six in order: the door opens
    for (const c of dn.order) dn.serve(dn.cloches.find((r) => r.c === c));
    out.opened = dn.doorOpen && dn.served === 6;
    sim(2.5);
    return out;
  });
  ok(r.six, 'dinner: six different courses');
  ok(r.stageCount === 5, `dinner: five stages (${r.stageCount})`);
  ok(r.hints === 'hotel.l8.hint1,hotel.l8.hint2,hotel.l8.hint3', `dinner: three hint levels for the dining room (${r.hints})`);
  ok(r.progressReset && r.trapSprang, 'dinner: a wrong course resets the meal and springs the dessert trolley');
  ok(r.warnFirst && r.cakeKills, 'dinner: the cake gives a warning, then flattens you if you stay');
  ok(r.trapOver && r.dodged, 'dinner: ...and you can dodge it');
  ok(r.opened, 'dinner: all six courses in the menu\'s order open the kitchen door');
  await page.close();
});

suite('dinner-pass', async () => {
  const page = await open(8);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, dn = w.dinner, sh = dn.sh, out = {};
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    g.player.teleport(5.4, 0.001, -23.9);
    // not rung yet: the domes do not answer
    dn.pickSlot(0); out.notYet = sh.phase === 'idle';
    dn.ringBell(); out.shows = sh.phase === 'show';
    sim(2.6); out.shuffling = sh.phase === 'shuffle';
    out.sevenSwaps = sh.swaps.length === 7;
    sim(6); out.pick = sh.phase === 'pick';
    // the host's pointing is wrong (it is never where the key is)
    out.hostLies = sh.lie !== dn.slotOfKey() && said.some((k) => k === 'hotel.l8.p.point');
    // a wrong dome is empty: the bell has to be rung again
    const wrongSlot = [0, 1, 2].find((s) => s !== dn.slotOfKey());
    dn.pickSlot(wrongSlot); out.wrongNoKey = !sh.got && sh.phase === 'wrong';
    sim(2); out.again = sh.phase === 'idle';
    // hint 3 at this stage names where the key is right now
    dn.ringBell(); sim(9); out.pick2 = sh.phase === 'pick';
    dn.pickSlot(dn.slotOfKey()); sim(2.5); out.round2 = sh.round === 1 && sh.phase === 'idle' && !sh.got; for (let k = 0; k < 2; k++) { dn.ringBell(); sim(16); dn.pickSlot(dn.slotOfKey()); sim(2.5); } out.key = sh.got;
    // the pantry door: locked without the key, and it is not the shell game's fault if you try it first
    out.doorShut = !dn.doorB.open;
    dn.doorBuse(); sim(2); out.doorOpens = dn.doorB.open;
    return out;
  });
  ok(r.notYet && r.shows, 'dinner: ring the bell and the key is shown under its dome first');
  ok(r.shuffling && r.sevenSwaps, 'dinner: the domes are then shuffled (seven swaps, more each round)');
  ok(r.pick && r.hostLies, 'dinner: the host confidently points at a dome with no key under it');
  ok(r.wrongNoKey && r.again, 'dinner: a wrong dome is empty; ring the bell and try again');
  ok(r.round2, 'dinner: double or nothing: the chef wants the shell game three times');
  ok(r.pick2 && r.key, 'dinner: the dome that holds the key gives the pantry key');
  ok(r.doorShut && r.doorOpens, 'dinner: the pantry door opens');
  await page.close();
});

suite('dinner-pantry', async () => {
  const page = await open(8);
  const r = await page.evaluate(async () => {
    const g = window.__trust, w = g.world, dn = w.dinner, out = {};
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    g.player.teleport(0, 0.001, -44);
    const T = dn.T, vals = dn.coins.map((c) => c.v);
    out.notTwenty = T !== 20 && T >= 27 && T <= 29;
    out.solvable = (() => { for (let m = 1; m < 128; m++) { let s = 0; for (let i = 0; i < 7; i++) if (m & (1 << i)) s += vals[i]; if (s === T) return true; } return false; })();
    // take everything: too much, the jar eats it all and the shelves restock
    for (const c of dn.coins) dn.takeCoin(c);
    dn.putIn(); out.overRestocks = dn.pocket.length === 0 && dn.coins.every((c) => !c.taken) && !dn.jarDone && said.includes('hotel.l8.t.over');
    // too little: the pocket stays
    dn.takeCoin(dn.coins.find((c) => c.v === 1)); dn.putIn();
    out.shortKeeps = dn.pocket.length === 1 && !dn.jarDone && said.includes('hotel.l8.t.short');
    // exactly the amount on the note: the cellar door opens
    for (const c of dn.coins) { if (c.taken) c.taken = false; }
    dn.pocket.length = 0; for (const c of dn.coins) { c.disc.visible = true; c.face.visible = true; }
    let pick = null; for (let m = 1; m < 128 && !pick; m++) { let s = 0; const sel = []; for (let i = 0; i < 7; i++) if (m & (1 << i)) { s += vals[i]; sel.push(dn.coins[i]); } if (s === T) pick = sel; }
    for (const c of pick) dn.takeCoin(c);
    dn.putIn(); sim(2.5);
    out.exactOpens = dn.jarDone && dn.doorC.open;
    return out;
  });
  ok(r.notTwenty && r.solvable, 'dinner: the jar wants a solvable amount that is not the host\'s twenty');
  ok(r.overRestocks, 'dinner: too much: the jar keeps it and the shelves restock');
  ok(r.shortKeeps, 'dinner: too little: the jar is unimpressed and you keep the coins');
  ok(r.exactOpens, 'dinner: exact change opens the cellar door');
  await page.close();
});

suite('dinner-cellar', async () => {
  const page = await open(8);
  const r = await page.evaluate(async () => {
    const g = window.__trust, w = g.world, dn = w.dinner, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    // barrels
    out.barrels = dn.barrels.length;
    g.player.teleport(0, 0.001, -70); const b = dn.barrels[0];
    g.player.teleport(b.body.x, 0.001, b.body.z); g._simulate(1 / 60); out.barrelKills = g.state === 'dead';
    g.state = 'playing'; g.respawnPlayer(false);
    for (const b2 of dn.barrels) b2.enabled = false;      // (the rest of this test is about the controls and the ring, not the barrels)
    // input lag in the middle of the aisle, announced and temporary
    g.player.teleport(0, 0.001, -75); sim(0.3); out.lag = g.mods.swapStrafe === true;
    g.player.teleport(0, 0.001, -63); sim(8.5); out.lagEnds = !g.mods.swapStrafe;
    // the ring at the end is the end of the level... for a moment
    g.player.teleport(dn.cellarGoal.x, 0.001, dn.cellarGoal.z); sim(0.3);
    out.fake = g.frozen === true && !!document.querySelector('.fakewin');
    for (let k = 0; k < 40 && !dn.doorD.open; k++) { await new Promise((res) => setTimeout(res, 250)); }
    sim(0.2);
    out.second = !g.frozen && g.state === 'playing' && dn.doorD.open;
    return out;
  });
  ok(r.barrels >= 5 && r.barrelKills, `dinner: ${r.barrels} barrels roll down the cellar and hurt`);
  ok(r.lag && r.lagEnds, 'dinner: a stretch of the cellar swaps A and D, then gives them back');
  ok(r.fake, 'dinner: the ring at the end of the cellar shows LEVEL COMPLETE');
  ok(r.second, 'dinner: ...which was a lie: the second sitting (the dessert parlour door) opens');
  await page.close();
});

suite('dinner-parlour', async () => {
  const page = await open(8);
  const r = await page.evaluate(async () => {
    const g = window.__trust, w = g.world, dn = w.dinner, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const stand = (x, y, z) => { g.player.teleport(x, y + 0.001, z); sim(0.1); };
    // the cream is a pit
    stand(0, 0, -108.4); out.cp = Math.abs(w.respawn.z + 108.4) < 0.8;
    stand(6, -0.2, -118); sim(0.4); out.creamKills = g.state === 'dead';
    g.state = 'playing'; g.respawnPlayer(false);
    // the meringue bridge gives way once you are past the middle
    const b = dn.D5.body; stand(b.x + b.hx - 0.7, dn.D5.top, b.z); sim(0.3);
    for (let k = 0; k < 6; k++) { g.player.teleport(b.x + b.hx - 0.7 - k * (b.hx * 1.8 / 6), dn.D5.top + 0.001, b.z); sim(0.12); }
    sim(1.5); out.bridgeGone = !b.enabled;
    // the cherry hops away twice
    g.state = 'playing'; g.respawnPlayer(false);
    const pos = () => `${dn.runner.x.toFixed(1)},${dn.runner.z.toFixed(1)}`;
    const seen = [pos()];
    for (let k = 0; k < 4; k++) { stand(dn.runner.x + 1.2, 11.4, dn.runner.z + 1.0); sim(0.9); seen.push(pos()); }
    out.hops = new Set(seen).size === 3;
    return out;
  });
  ok(r.cp, 'dinner: the parlour has its own checkpoint');
  ok(r.creamKills, 'dinner: the cream floor is lethal');
  ok(r.bridgeGone, 'dinner: the meringue bridge gives way once you are past the middle');
  ok(r.hops, 'dinner: the cherry hops away twice, then stays');
  await page.close();
});

suite('dinner-dumbwaiter', async () => {
  const page = await open(8);
  const r = await page.evaluate(async () => {
    const g = window.__trust, w = g.world, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const door = w.interactables.find((i) => /EXIT door|staff closet/.test(typeof i.label === 'function' ? i.label() : i.label));
    out.hasDoor = !!door;
    g.player.teleport(8.2, 0.001, -46); sim(0.2); door.onUse(g);
    for (let k = 0; k < 20 && g.state !== 'dead'; k++) { await new Promise((res) => setTimeout(res, 300)); sim(0.1); }
    out.kills = g.state === 'dead';
    return out;
  });
  ok(r.hasDoor && r.kills, 'dinner: the dumbwaiter is a fake exit (a closet with no floor)');
  await page.close();
});
// ---- level 11: Room 404 (four rooms: the bedroom · the bathroom · the hallway · the stairwell) -----------------------------------
suite('room404', async () => {
  const page = await open(11);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, rm = w.room404, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const face = (x, z) => { const p = g.player; g.yaw = Math.atan2(-(x - p.x), -(z - p.z)); g.pitch = 0; };
    const bed = rm.pieces.find((p) => p.name === 'bed'), chair = rm.pieces.find((p) => p.name === 'armchair');
    out.code = rm.code; out.notFake = rm.code !== rm.fake && rm.codeB !== '404' && rm.codeC !== '404';
    out.stages = rm.stages.defs.length;
    // hints: a clue ladder for the bedroom only
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    g.debug = false; for (let i = 0; i < 3; i++) { g.hintCool = 0; g.useHint(); }
    out.hints = said.filter((k) => /l11\.hint/.test(k)).join(',');
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
    face(bed.cx, bed.cz); sim(3.5); out.bedStays = bed.slot === slot0;
    const before = rm.pieces.map((p) => p.slot).join();
    g.yaw += Math.PI; sim(4);
    out.moves = rm.pieces.map((p) => p.slot).join() !== before;
    // a blackout counts as not looking, even if you are facing the wardrobe
    rm.ward.active = true; g.player.teleport(0, 0.001, 8); face(rm.ward.x, rm.ward.z); rm.setDark(true);
    const w2 = [rm.ward.x, rm.ward.z]; sim(0.8); out.darkWalks = Math.hypot(rm.ward.x - w2[0], rm.ward.z - w2[1]) > 0.8;
    rm.setDark(false);
    g.player.teleport(rm.ward.x + 0.5, 0.001, rm.ward.z + 0.5); g.yaw += Math.PI; sim(0.2);
    out.kills = g.state === 'dead';
    return out;
  });
  ok(r.notFake, `room404: no real code is the host's 404 (${r.code})`);
  ok(r.stages === 4, `room404: four stages (${r.stages})`);
  ok(r.hints === 'hotel.l11.hint1,hotel.l11.hint2,hotel.l11.hint3', `room404: a clue ladder for the bedroom (${r.hints})`);
  ok(r.digits, 'room404: the bed, desk and dresser hold the three digits');
  ok(r.frozenWhenWatched && r.walksWhenNot, 'room404: the wardrobe is frozen while watched and walks when you look away');
  ok(r.bedStays && r.moves, 'room404: furniture holds still while watched, and moves when you are not looking');
  ok(r.darkWalks, 'room404: in a blackout the wardrobe moves even if you face it');
  ok(r.kills, 'room404: the wardrobe is fatal');
  await page.close();
});

suite('room404-bath', async () => {
  const page = await open(11);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, rm = w.room404, out = {};
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const type = (c) => { for (const d of c) g.modal.key({ code: 'Digit' + d }); g.modal.key({ code: 'Enter' }); };
    // the bedroom door: the armchair's 404 is wrong, the real code opens it
    rm.useKeypad(); type('404'); out.fakeDenied = !rm.doorOpen && said.includes('hotel.l11.fake'); g.modal.close();
    rm.useKeypad(); type(rm.code); sim(1.6); out.opens = rm.doorA.open;
    // the bathroom: lit, the wall is blank; dark, the digits glow (backwards on the wall, right way round in the mirror)
    g.player.teleport(0, 0.001, -16); sim(0.2);
    out.zone = rm.zoneOf(g.player.z) === 'bath';
    out.litBlank = rm.bath.lit && rm.bath.digits.every((m) => !m.visible);
    sim(4.6); out.darkShows = !rm.bath.lit && rm.bath.digits.every((m) => m.visible);
    out.mirrored = g.mods.invertX === true;
    sim(5.5); out.litAgain = rm.bath.lit && rm.bath.digits.every((m) => !m.visible);
    // the code is the digits in the mirror; the backwards number gets a hint of its own
    g.player.teleport(0, 0.001, -26); sim(0.1);
    rm.useKeypadB(); type(rm.codeB.split('').reverse().join('')); out.revHint = !rm.doorB.open && (rm.codeB.split('').reverse().join('') === rm.codeB || said.includes('hotel.l11.b.rev')); g.modal.close();
    rm.useKeypadB(); type(rm.codeB); sim(1.6); out.bOpens = rm.doorB.open;
    out.mouseRestored = (sim(8), !g.mods.invertX);
    return out;
  });
  ok(r.fakeDenied && r.opens, 'room404: the host\'s 404 is refused, the found code opens the bedroom door');
  ok(r.zone && r.litBlank, 'room404: with the bathroom light on, the wall is blank');
  ok(r.darkShows, 'room404: when the light goes out, glowing digits show on the wall');
  ok(r.mirrored && r.litAgain, 'room404: the dark brings a mirrored mouse, which wears off, and the light comes back');
  ok(r.revHint && r.bOpens && r.mouseRestored, 'room404: the digits read backwards get a hint; the mirror\'s order opens the door');
  await page.close();
});

suite('room404-hall', async () => {
  const page = await open(11);
  const r = await page.evaluate(async () => {
    const g = window.__trust, w = g.world, rm = w.room404, out = {};
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const type = (c) => { for (const d of c) g.modal.key({ code: 'Digit' + d }); g.modal.key({ code: 'Enter' }); };
    // three plaques are lit, and they spell the code from the bathroom end
    const lit = rm.plates.filter((p) => p.lit).sort((a, b) => b.z - a.z);
    out.threeLit = lit.length === 3;
    g.player.teleport(0, 0.001, -29.8); sim(0.3);
    out.expiring = !!w._troll;
    // the wardrobe is in the hall: unwatched and past the first doors it walks, fast; watched it stops
    g.player.teleport(0, 0.001, -45); sim(0.2); rm.ward.active = true;
    g.yaw = 0;       // facing away (north)
    const a = [rm.ward.x, rm.ward.z]; sim(1); out.hallWalks = Math.hypot(rm.ward.x - a[0], rm.ward.z - a[1]) > 3;
    g.yaw = Math.PI; sim(0.1); const b = [rm.ward.x, rm.ward.z]; sim(1); out.hallFrozen = Math.hypot(rm.ward.x - b[0], rm.ward.z - b[1]) < 0.01;
    g.yaw = 0; g.player.teleport(rm.ward.x - 0.3, 0.001, rm.ward.z - 0.8); sim(0.3); out.hallKills = g.state === 'dead';
    g.state = 'playing'; g.respawnPlayer(false); rm.ward.active = false;
    // the host's 404 opens a door onto Room 404, again
    g.player.teleport(0, 0.001, -68.4); sim(0.2);
    rm.useKeypadC(); type('404'); for (let k = 0; k < 20 && !rm.doorLoop.open; k++) { await new Promise((res) => setTimeout(res, 150)); sim(0.1); } sim(1.5);
    out.loopOpens = rm.doorLoop.open && !rm.doorStairs.open;
    g.modal?.close?.(); g.modal = null;
    g.player.teleport(-2.4, 0.001, -70.4); sim(0.2);
    out.loops = g.player.z > -35 && said.includes('hotel.l11.loop');
    // the real code opens the stairs
    g.player.teleport(0, 0.001, -68.4); sim(0.2);
    rm.useKeypadC(); type(lit.map((p) => rm.codeC[rm.plates.filter((q) => q.lit).sort((x, y) => y.z - x.z).indexOf(p)]).join('')); for (let k = 0; k < 20 && !rm.doorStairs.open; k++) { await new Promise((res) => setTimeout(res, 150)); sim(0.1); }
    out.realOpens = rm.doorStairs.open || (type(rm.codeC), false);
    return out;
  });
  ok(r.threeLit, 'room404: three door plaques in the hallway are lit');
  ok(r.hallWalks && r.hallFrozen && r.hallKills, 'room404: the hallway wardrobe walks when unwatched, stops when watched, and is fatal');
  ok(r.loopOpens && r.loops, 'room404: the host\'s 404 opens a door onto Room 404, again (back to the start of the hallway)');
  ok(r.realOpens, 'room404: the lit digits, in order, open the stairs door');
  await page.close();
});

suite('room404-stairs', async () => {
  const page = await open(11);
  const r = await page.evaluate(async () => {
    const g = window.__trust, w = g.world, rm = w.room404, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    const stand = (x, y, z) => { g.player.teleport(x, y + 0.001, z); sim(0.1); };
    stand(0, 0, -72.4); sim(0.3); out.cp = Math.abs(w.respawn.z + 72.4) < 0.8;
    out.fallKills = (stand(2, -13, -80), sim(0.5), g.state === 'dead');
    g.state = 'playing'; g.respawnPlayer(false);
    // the exit runs away twice, then a fake LEVEL COMPLETE, then a bonus climb
    const pos = () => `${rm.runner.x.toFixed(1)},${rm.runner.z.toFixed(1)}`;
    const seen = [pos()];
    for (let k = 0; k < 2; k++) { stand(rm.runner.x + (rm.runner.x > 0 ? -1.2 : 1.2), 8, rm.runner.z + 0.5); sim(0.9); seen.push(pos()); }
    out.hops = new Set(seen).size === 3; out.seen = seen.join(' | ') + ' ' + g.state;
    stand(rm.runner.x + (rm.runner.x > 0 ? -0.3 : 0.3), 8, rm.runner.z + 0.3); sim(0.3);
    out.fake = g.frozen === true && !!document.querySelector('.fakewin') && !rm.bonusOn;
    for (let k = 0; k < 40 && !rm.bonusOn; k++) { await new Promise((res) => setTimeout(res, 250)); }
    sim(0.3); out.bonus = rm.bonusOn && !g.frozen && rm.bonus.every((p) => p.body.enabled) && rm.finalGoal.group.visible;
    return out;
  });
  ok(r.cp && r.fallKills, 'room404: the stairwell has a checkpoint, and falling off the steps is fatal');
  ok(r.hops, 'room404: the exit at the top hops away twice (' + r.seen + ')');
  ok(r.fake && r.bonus, 'room404: reaching it shows LEVEL COMPLETE, which is a lie, and a bonus climb appears');
  await page.close();
});

// <<< escape rooms

const names = Object.keys(suites).filter((n) => n.includes(filter));
for (const n of names) { console.log(`\n== ${n}`); await suites[n](); }
await browser.close();
if (errs.length) { console.log('PAGE ERRORS:', errs.join('\n')); fails++; }
console.log(fails ? `\n${fails} FAILED` : '\nall floor tests passed');
process.exit(fails ? 1 : 0);
