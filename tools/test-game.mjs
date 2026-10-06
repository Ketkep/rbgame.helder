// In-browser logic tests (needs `vite preview` on :4173). Verifies the game rules that make it "Trust Me…".
import { chromium } from 'playwright-core';

const base = process.env.BASE || 'http://localhost:4173/';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const errs = [];

async function open(level, campaign) {
  const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}?debug${campaign ? `&campaign=${campaign}` : ''}${level ? `&level=${level}` : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__trust && window.__trust.world && window.__trust.state === 'playing', null, { timeout: 60000 });
  await page.evaluate(() => { window.__trust.manual = true; });
  return page;
}
const stepN = (page, n) => page.evaluate((n) => { const g = window.__trust; for (let i = 0; i < n; i++) g._simulate(1 / 60); }, n);

// ---- home page (real, non-debug mode) ---------------------------------------------------------
{
  const fresh = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  fresh.on('pageerror', (e) => errs.push(e.message));
  await fresh.goto(base, { waitUntil: 'load' });
  await fresh.waitForSelector('.card');
  const r = await fresh.evaluate(() => ({
    cards: document.querySelectorAll('.card').length,
    playable: document.querySelectorAll('.card.playable').length,
    soon: document.querySelectorAll('.card.soon').length,
    btn: document.querySelector('.card.playable .btn.primary').textContent,
    pips: [...document.querySelector('.card.playable').querySelectorAll('.pip')].map((p) => p.className.replace('pip ', '')),
  }));
  ok(r.cards === 3 && r.playable === 2 && r.soon === 1, `home shows 2 playable (Campaign 1 + Hotel) + 1 coming-soon campaign (${r.playable}/${r.soon})`);
  ok(r.btn === 'Play', 'fresh player sees "Play"');
  ok(JSON.stringify(r.pips) === JSON.stringify(['open', 'locked', 'locked', 'locked', 'locked']), `fresh player: only level 1 unlocked (${r.pips})`);
  await fresh.click('.card.playable .btn.ghost');
  const tiles = await fresh.evaluate(() => [...document.querySelectorAll('.tile')].map((t) => t.disabled));
  ok(JSON.stringify(tiles) === JSON.stringify([false, true, true, true, true]), `level select: levels 2-5 locked at first (${tiles})`);
  await fresh.close();

  // a v1 save (from before the home page existed) is migrated, not lost
  const old = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  old.on('pageerror', (e) => errs.push(e.message));
  await old.addInitScript(() => localStorage.setItem('trustme.save.v1', JSON.stringify({ level: 2, deaths: 31, time: 400, baby: true, levelDeaths: [3, 12], levelTimes: [60, 120] })));
  await old.goto(base, { waitUntil: 'load' });
  await old.waitForSelector('.card');
  const m = await old.evaluate(() => ({
    btn: document.querySelector('.card.playable .btn.primary').textContent,
    stats: document.querySelector('.card-stats').textContent,
    pips: [...document.querySelectorAll('.card.playable .pip')].map((p) => p.className.replace('pip ', '')),
  }));
  ok(m.btn === 'Continue', `v1 save migrated: Continue offered (${m.btn})`);
  ok(/Level 3/.test(m.stats) && /31/.test(m.stats), `v1 save migrated: level + death count kept (${m.stats})`);
  ok(m.pips.slice(0, 3).every((p) => p !== 'locked') && m.pips[3] === 'locked', `v1 save migrated: levels up to 3 unlocked (${m.pips})`);
  await old.close();
}

// ---- Level 2: fake vs real checkpoints -------------------------------------------------------
{
  const page = await open(2);
  const r = await page.evaluate(async () => {
    const g = window.__trust, w = g.world;
    const cps = w.checkpoints;
    const out = { n: cps.length, real: cps.map((c) => c.real) };
    // touch CP2 (real) then CP3 (fake) then die: should respawn at CP2
    const go = (cp) => { g.player.teleport(cp.x, cp.y + 0.01, cp.z); for (let i = 0; i < 5; i++) g._simulate(1 / 60); };
    go(cps[1]); out.afterReal = { ...w.respawn };
    go(cps[2]); out.afterFake = { ...w.respawn }; out.cp2z = cps[1].z; out.cp3z = cps[2].z;
    out.lastFake = !!g.lastFakeCp;
    g.kill('fall');
    out.state = g.state;
    return out;
  });
  ok(r.n === 5, `Level 2 has 5 checkpoints (got ${r.n})`);
  ok(JSON.stringify(r.real) === JSON.stringify([true, true, false, true, false]), `real/fake pattern R R F R F (${r.real})`);
  ok(Math.abs(r.afterReal.z - r.cp2z) < 0.01, 'real checkpoint updates respawn');
  ok(Math.abs(r.afterFake.z - r.cp2z) < 0.01, 'FAKE checkpoint does NOT update respawn');
  ok(r.lastFake, 'game remembers the fake checkpoint for the reveal');
  // baby mode makes fake checkpoints real
  const b = await page.evaluate(() => {
    const g = window.__trust, w = g.world;
    g.state = 'playing'; g.baby = true; g.world.checkpoints[2].used = false;
    const cp = w.checkpoints[2];
    g.player.teleport(0, 0.01, 3); for (let i = 0; i < 5; i++) g._simulate(1 / 60);   // step out of the trigger first
    g.player.teleport(cp.x, cp.y + 0.01, cp.z); for (let i = 0; i < 5; i++) g._simulate(1 / 60);
    return { rz: w.respawn.z, cz: cp.z };
  });
  ok(Math.abs(b.rz - b.cz) < 0.01, 'baby mode: fake checkpoint actually saves');
  await page.close();
}

// ---- death / respawn / counters ---------------------------------------------------------------
{
  const page = await open(1);
  const r = await page.evaluate(() => {
    const g = window.__trust;
    const out = {};
    g.player.teleport(0, -50, 5); g._simulate(1 / 60);
    out.state = g.state; out.deaths = g.deaths; out.total = g.totalDeaths;
    return out;
  });
  ok(r.state === 'dead' && r.deaths === 1 && r.total === 1, 'falling into the void kills and counts a death');
  await page.waitForFunction(() => window.__trust.state === 'playing', null, { timeout: 20000 });
  const p = await page.evaluate(() => ({ z: window.__trust.player.z, y: window.__trust.player.y }));
  ok(Math.abs(p.z - 5) < 0.2 && p.y > -0.5, `respawns at the start (z=${p.z.toFixed(1)}, y=${p.y.toFixed(2)})`);
  // baby mode offer after 25 deaths
  const offer = await page.evaluate(() => {
    const g = window.__trust;
    g.totalDeaths = 24; g.deaths = 24; g.state = 'playing';
    g.kill('fall');
    return { shown: g.babyOfferShown, chip: !document.getElementById('baby-offer').classList.contains('hidden') };
  });
  ok(offer.shown && offer.chip, 'baby-mode offer appears at 25 deaths');
  await page.waitForFunction(() => window.__trust.state === 'playing', null, { timeout: 20000 });
  const acc = await page.evaluate(() => { const g = window.__trust; g.keys.add('KeyB'); g.acceptBaby(); return { baby: g.baby, badge: !document.getElementById('baby-badge').classList.contains('hidden') }; });
  ok(acc.baby && acc.badge, 'accepting baby mode sets the badge');
  await page.close();
}

// ---- save / continue -------------------------------------------------------------------------
{
  const page = await open(1);
  const r = await page.evaluate(() => {
    const g = window.__trust; g.totalDeaths = 9; g.deaths = 9; g.completeLevel();
    return JSON.parse(localStorage.getItem('trustme.save.v2')).campaigns.pilot;
  });
  ok(r.level === 1 && r.deaths === 9, `progress saved after level 1 (level=${r.level}, deaths=${r.deaths})`);
  ok(r.furthest >= 1 && r.levelBest['0'] && r.levelBest['0'].deaths === 9, 'level 1 recorded as cleared with its best stats');
  await page.close();
}

// ---- Level 5: wrong door kills, right door wins -----------------------------------------------
{
  const page = await open(5);
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world;
    g.ui.creditsStop();
    const goals = w.triggers.filter((t) => t.body.hy > 1.5 && t.once);   // portal triggers
    const left = goals.find((t) => t.body.x < 0 && t.body.y > 5), right = goals.find((t) => t.body.x > 0 && t.body.y > 5);
    g.player.teleport(left.body.x, left.body.y - 1.8, left.body.z); g._simulate(1 / 60);
    const out = { leftState: g.state, deaths: g.deaths };
    return out;
  });
  ok(r.leftState === 'dead' && r.deaths === 1, `LEFT door ("trust me") kills you (state=${r.leftState})`);
  await page.waitForFunction(() => window.__trust.state === 'playing', null, { timeout: 20000 });
  const r2 = await page.evaluate(() => {
    const g = window.__trust, w = g.world;
    const right = w.triggers.find((t) => t.once && t.body.hy > 1.5 && t.body.x > 0 && t.body.y > 5);
    g.player.teleport(right.body.x, right.body.y - 1.8, right.body.z); g._simulate(1 / 60);
    return { st: g.state };
  });
  ok(r2.st === 'complete' || r2.st === 'ended', `RIGHT door completes the game (state=${r2.st})`);
  await page.waitForFunction(() => document.getElementById('scr-end').classList.contains('show'), null, { timeout: 15000 });
  const end = await page.evaluate(() => document.getElementById('end-share').textContent);
  ok(/TRUST ME/.test(end) && /deaths/.test(end) && /trustme\.helderlabs\.com/.test(end), 'end screen builds a shareable result with the domain');
  await page.close();
}

// ---- Hotel Trust-Me: lobby hub, elevators, level, back to lobby ----------------------------------
{
  const page = await open(0, 'hotel');
  const lbl = (i) => `(typeof ${i}.label === 'function' ? ${i}.label(g) : ${i}.label)`;
  const h = await page.evaluate(() => {
    const g = window.__trust, w = g.world;
    const labels = w.interactables.map((it) => (typeof it.label === 'function' ? it.label(g) : it.label));
    return { inHub: g.inHub, idx: g.levelIndex, n: w.interactables.length, calls: labels.filter((l) => /elevator|Out of order/.test(l)).length, levelBtns: labels.filter((l) => /^Level \d+:/.test(l)).length, step: w.stepHeight };
  });
  ok(h.inHub && h.idx === -1, 'hotel: the campaign opens in the lobby hub');
  ok(h.calls === 5 && h.levelBtns === 25, `hotel: 5 elevator call buttons + 25 level buttons (${h.calls}/${h.levelBtns})`);
  ok(h.step > 0, 'hotel: stairs/thresholds enabled in the lobby (step-up)');

  // floor 1 is open, the others are not (debug mode unlocks everything, so turn that off for this check)
  const calls = await page.evaluate(() => { const g = window.__trust; g.debug = false; return g.world.interactables.filter((it) => /elevator|Out of order/.test(typeof it.label === 'function' ? it.label(g) : it.label)).map((it) => it.label(g)); });
  ok(/Call elevator/.test(calls[0]) && calls.slice(1).every((c) => c === 'Out of order'), `hotel: only floor 1's elevator works at first (${calls.map((c) => c.slice(0, 14))})`);

  // look at the call button -> prompt -> press -> doors open
  const r1 = await page.evaluate(() => {
    const g = window.__trust;
    g.player.teleport(-9.7, 0.01, -21); g.yaw = 0; g.pitch = 0.0;
    g._simulate(1 / 60);
    const label = g.focus ? g.focus.label(g) : null;
    g.useFocus();
    for (let i = 0; i < 150; i++) g._simulate(1 / 60);
    const leaves = g.world.plats.filter((p) => p.o.moving && p.o.tex === 'brass');
    const moved = leaves.slice(0, 2).map((p) => +(p.body.x - p.base.x).toFixed(2));
    return { label, moved };
  });
  ok(/Call elevator/.test(r1.label || ''), `hotel: crosshair on the call button shows a prompt (${r1.label})`);
  ok(r1.moved[0] < -1 && r1.moved[1] > 1, `hotel: pressing it slides the doors open (${r1.moved})`);

  // inside the car: aim at the "Level 1" button and ride
  const r2 = await page.evaluate(() => {
    const g = window.__trust;
    g.player.teleport(-12, 0.01, -26.2); g.yaw = 0; g.pitch = -0.16;
    for (let i = 0; i < 3; i++) g._simulate(1 / 60);
    const label = g.focus ? g.focus.label(g) : null;
    g.useFocus();
    for (let i = 0; i < 420 && g.levelIndex === -1; i++) g._simulate(1 / 60);
    return { label };
  });
  ok(/^Level 1: Wet Floor/.test(r2.label || ''), `hotel: button inside the car targets level 1 (${r2.label})`);
  await page.waitForFunction(() => window.__trust.levelIndex === 0 && !window.__trust.inHub, null, { timeout: 60000 });
  ok(true, 'hotel: the elevator ride delivers you into level 1 (Wet Floor)');

  // beat it -> complete screen offers the lobby (not a non-existent level 2)
  await page.evaluate(() => { const g = window.__trust; g.state = 'playing'; g.completeLevel(); });
  await page.waitForFunction(() => document.getElementById('scr-complete').classList.contains('show'), null, { timeout: 30000 });
  const c = await page.evaluate(() => ({ lobby: !document.getElementById('btn-lobby').classList.contains('hidden'), next: !document.getElementById('btn-next').classList.contains('hidden'), save: JSON.parse(localStorage.getItem('trustme.save.v2')).campaigns.hotel }));
  ok(c.lobby && c.next, 'hotel: complete screen offers "Back to the lobby" and the next level (Check-In)');
  ok(c.save.levelBest['0'] && c.save.levelBest['0'].deaths === 0, 'hotel: level 1 recorded as cleared');
  await page.evaluate(() => document.getElementById('btn-lobby').click());
  await page.waitForFunction(() => window.__trust.inHub && window.__trust.state === 'playing', null, { timeout: 60000 });
  const back = await page.evaluate(() => {
    const g = window.__trust, p = g.player;
    const calls = g.world.interactables.filter((it) => /elevator|Out of order/.test(typeof it.label === 'function' ? it.label(g) : it.label)).map((it) => it.label(g));
    const firstPlanned = g.campaign.levels.findIndex((l) => l.placeholder) + 1;
    const lv4 = g.world.interactables.find((it) => new RegExp(`^Level ${firstPlanned}:`).test(typeof it.label === 'function' ? it.label(g) : it.label));
    return { z: p.z, x: p.x, calls, lv2: lv4.label(g) };
  });
  ok(back.z < -24 && Math.abs(back.x + 12) < 0.5, `hotel: you arrive back inside floor 1's elevator (x=${back.x.toFixed(1)}, z=${back.z.toFixed(1)})`);
  ok(/under renovation/.test(back.lv2), `hotel: levels that are not built yet are marked under renovation (${back.lv2})`);
  ok(back.calls.slice(1).every((c) => c === 'Out of order'), 'hotel: later floors stay locked until the tier is cleared');
  await page.close();
}

// ---- Hotel level 1: hints, slippery marble, runaway trolley -------------------------------------
{
  const page = await open(1, 'hotel');
  const r = await page.evaluate(() => {
    const g = window.__trust; g.debug = false; g.hintCool = 0;
    const w = g.world;
    g.useHint();
    const a = { active: !!(w.hintTrail && w.hintTrail.active), cool: g.hintCool, hints: g.levelHints };
    g.useHint();                                   // still on cooldown -> no second use
    const b = { hints: g.levelHints };
    g.baby = true; g.hintCool = 0; g.useHint();
    const c = { cool: g.hintCool };
    for (let i = 0; i < 60 * 16; i++) g._simulate(1 / 60);
    return { a, b, c, still: !!w.hintTrail.active, coolAfter: g.hintCool };
  });
  ok(r.a.active && r.a.hints === 1, 'hint (H) draws a trail');
  ok(r.a.cool > 20 && r.b.hints === 1, `hint has a cooldown (${r.a.cool}s) and blocks a second use`);
  ok(r.c.cool > 0 && r.c.cool < 10, `baby mode recharges the hint much faster (${r.c.cool}s)`);
  ok(!r.still && r.coolAfter === 0, 'trail fades out on its own and the cooldown recovers');

  const s = await page.evaluate(() => {
    const g = window.__trust, w = g.world;
    const slippery = w.bodies.filter((b) => b.slip > 0).length;
    // stand on the trolley (the only platform with a rollaway) and see if it leaves
    const tr = w.plats.find((p) => Math.abs(p.base.x - 3.4) < 0.01 && Math.abs(p.base.z + 8.6) < 0.01);
    g.player.teleport(3.4, tr.top, -8.6); g.player.grounded = true; g.player.ground = tr.body;
    for (let i = 0; i < 20; i++) g._simulate(1 / 60);
    const x0 = tr.body.x;
    for (let i = 0; i < 150; i++) g._simulate(1 / 60);
    const moved = tr.body.x - x0, carried = g.player.x - 3.4;
    return { slippery, moved, carried };
  });
  ok(s.slippery >= 4, `wet-floor: marble tops are slippery (${s.slippery} bodies)`);
  ok(s.moved > 2, `wet-floor: the trolley rolls away under you (${s.moved.toFixed(1)} m)`);
  ok(s.carried > 2, `wet-floor: ...and takes you with it (${s.carried.toFixed(1)} m)`);
  await page.close();
}

// ---- Hotel level 2: the quiz room ---------------------------------------------------------------
{
  const page = await open(2, 'hotel');
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, qz = w.quiz, out = {};
    const sim = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g._simulate(1 / 60); };
    const stand = (pad) => { const b = pad.plat.body; g.player.teleport(b.x, b.top + 0.001, b.z); g.player.grounded = true; g.player.ground = b; };
    out.stages = qz.stages.length;
    out.threeAnswers = qz.stages.every((s) => s.pads.length === 3 && s.pads.filter((p) => p.correct).length === 1);
    out.gatesShut = qz.stages.every((s) => s.gate.body.enabled);
    out.boardsHidden = qz.stages.slice(1).every((s) => !s.board.visible);
    // wrong answer on question 1: lock in, then the pad drops and you die
    const s0 = qz.stages[0];
    stand(s0.wrongPads[0]); sim(0.5);
    out.locking = s0.wrongPads[0].state;
    sim(0.8);
    out.wrongState = s0.wrongPads[0].state;
    sim(3);
    out.deadAfterWrong = g.state === 'dead';
    g.state = 'playing'; g.respawnPlayer(false);
    out.padsReset = s0.pads.every((p) => p.state === 'idle' && p.plat.body.enabled);
    // the 50/50 hint takes away one wrong pad (and not the right one)
    g.debug = false; g.hintCool = 0; g.useHint();
    out.eliminated = s0.pads.filter((p) => p.eliminated).length;
    out.rightKept = s0.correctPad.plat.body.enabled && !s0.correctPad.eliminated;
    sim(3); g.hintCool = 0; g.useHint();
    out.eliminated2 = s0.pads.filter((p) => p.eliminated).length;
    g.hintCool = 0; g.useHint();      // nothing left to remove: no charge
    out.eliminated3 = s0.pads.filter((p) => p.eliminated).length;
    // right answer: gate opens, next board appears
    g.respawnPlayer(false);
    stand(s0.correctPad); sim(1.2);
    out.cleared = qz.cleared; out.gateOpen = !s0.gate.body.enabled; out.nextBoard = qz.stages[1].board.visible;
    // stand on the next island: respawn moves up
    const i1 = qz.islands[1]; g.player.teleport(0, 0.001, i1.zN + 3); sim(0.3);
    out.respawnZ = w.respawn.z; out.islandZ = i1.zN + 3;
    // a death on question 2 keeps question 1 solved
    g.kill('fall'); g.state = 'playing'; g.respawnPlayer(false);
    out.keptProgress = qz.cleared === 1 && !qz.stages[0].gate.body.enabled && qz.stages[1].gate.body.enabled;
    return out;
  });
  ok(r.stages === 4 && r.threeAnswers, 'check-in: 4 questions, each with 3 answers and exactly one right');
  ok(r.gatesShut && r.boardsHidden, 'check-in: every gate starts shut; later questions are hidden');
  ok(r.locking === 'lock', 'check-in: standing on a pad starts locking the answer in');
  ok(r.wrongState === 'wrong' && r.deadAfterWrong, 'check-in: a wrong answer drops the pad and kills you');
  ok(r.padsReset, 'check-in: the pads come back after you respawn');
  ok(r.eliminated === 1 && r.rightKept, 'check-in: hint (50/50) removes one WRONG pad and keeps the right one');
  ok(r.eliminated2 === 2 && r.eliminated3 === 2, 'check-in: a second hint removes the other wrong pad, a third finds nothing to remove');
  ok(r.cleared === 1 && r.gateOpen && r.nextBoard, 'check-in: the right answer opens the gate and reveals the next question');
  ok(Math.abs(r.respawnZ - r.islandZ) < 0.6, 'check-in: reaching the next island saves your progress');
  ok(r.keptProgress, 'check-in: dying on question 2 keeps question 1 solved');
  await page.close();
}

// ---- Hotel level 3: the escape room -----------------------------------------------------------------
{
  const page = await open(3, 'hotel');
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, es = w.escape, out = {};
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    const type = (c) => { for (const d of c) g.modal.key({ code: 'Digit' + d }); g.modal.key({ code: 'Enter' }); };
    out.code = es.code; out.fake = es.fake;
    out.countsOk = es.pallets.every((p) => p.n >= 2 && p.n <= 6) && es.order.map((c) => es.pallets.find((p) => p.col === c).n).join('') === es.code;
    out.differs = es.code !== es.fake;
    // the keypad takes the keyboard: walking is disabled while it is open
    g.player.teleport(3.7, 0.001, -6.8);
    g.keys.add('KeyW');
    es.useKeypad(g);
    out.modalOpen = !!g.modal;
    g.keys.add('KeyW'); const z0 = g.player.z; for (let i = 0; i < 30; i++) g._simulate(1 / 60);
    out.frozenWhileOpen = Math.abs(g.player.z - z0) < 0.05;
    const shown = () => [...document.querySelectorAll('.kp-digit')].map((d) => d.textContent).join('');
    type('0000'); out.afterWrong = shown(); out.msgWrong = document.querySelector('.kp-msg').textContent;
    type(es.fake); out.fakeSaid = said.includes('hotel.l3.fake');
    type('0001'); out.locked = /LOCKED/.test(document.querySelector('.kp-msg').textContent);
    out.doorShut = !es.doorOpen;
    g.modal.close(); g.modal = null;
    return out;
  });
  ok(r.countsOk && r.differs, `lost-luggage: the code is the suitcase counts (${r.code}) and is not the host's number (${r.fake})`);
  ok(r.modalOpen && r.frozenWhileOpen, 'lost-luggage: the keypad takes the keyboard (no walking while it is open)');
  ok(r.afterWrong === '····' && /DENIED/.test(r.msgWrong), 'lost-luggage: a wrong code is denied and cleared');
  ok(r.fakeSaid, 'lost-luggage: typing the host\'s fake code gets a roast');
  ok(r.locked && r.doorShut, 'lost-luggage: three wrong tries lock the keypad for a while');
  const r2 = await page.evaluate(() => {
    const g = window.__trust, w = g.world, es = w.escape, out = {};
    // hint tiers: rule -> two digits -> whole code, all before the door is open
    const said = []; const os = g.narrator.say.bind(g.narrator); g.narrator.say = (k, o) => { said.push(k); return os(k, o); };
    g.debug = false;
    for (let i = 0; i < 3; i++) { g.hintCool = 0; g.useHint(); }
    out.hints = said.filter((k) => /hotel\.l3\.hint/.test(k)).join(',');
    // the mimic
    g.state = 'playing';
    const mimic = w.interactables.find((it) => it.label === 'Open suitcase' && Math.abs(it.body.x + 3.6) < 0.1);
    mimic.onUse(g);
    out.dead = g.state === 'dead';
    g.state = 'playing'; g.respawnPlayer(false);
    // right code
    g.player.teleport(3.7, 0.001, -6.8);
    es.useKeypad(g);
    for (const d of es.code) g.modal.key({ code: 'Digit' + d }); g.modal.key({ code: 'Enter' });
    return out;
  });
  ok(r2.hints === 'hotel.l3.hint1,hotel.l3.hint2,hotel.l3.hint3', `lost-luggage: three hint levels (${r2.hints})`);
  ok(r2.dead, 'lost-luggage: the black suitcase is a mimic');
  await page.waitForFunction(() => window.__trust.world.escape.doorOpen, null, { timeout: 15000 });
  const r3 = await page.evaluate(() => { const g = window.__trust; for (let i = 0; i < 150; i++) g._simulate(1 / 60); const d = g.world.bodies.find((b) => Math.abs(b.x) < 0.01 && Math.abs(b.hx - 2) < 0.01 && Math.abs(b.hy - 2.2) < 0.01); return { open: g.world.escape.doorOpen, doorGone: !d || !d.enabled || d.y > 5, modal: !!g.modal }; });
  ok(r3.open && !r3.modal && r3.doorGone, 'lost-luggage: the right code opens the door');
  await page.close();
}

// ---- Hotel level 4: the rooftop maze ------------------------------------------------------------------
{
  const page = await open(4, 'hotel');
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, m = w.maze, out = {};
    const sol = m.solve([0, 0]);
    out.solved = sol.length > 12 && sol[0].join() === '0,0' && sol[sol.length - 1].join() === `${m.N - 1},${m.N - 1}`;
    out.doors = m.doors.length; out.decoys = m.doors.filter((d) => d.decoy).length;
    // doors alternate between blocking and open
    const seen = m.doors.map(() => new Set());
    for (let i = 0; i < 60 * 8; i++) { g._simulate(1 / 60); m.doors.forEach((d, k) => seen[k].add(d.body.enabled)); }
    out.doorsCycle = seen.every((s) => s.size === 2);
    // the hint draws the way out from where you stand, as a flat trail
    g.debug = false; g.hintCool = 0;
    const pts = g._hintPoints();
    out.hintLen = pts.length; out.hintEndsAtExit = pts[pts.length - 1].z < m.Z0 - m.N * m.C;
    g.useHint(); out.hintOn = !!(w.hintTrail && w.hintTrail.active);
    // standing in the middle of the maze still gives a hint toward the exit
    g.player.teleport(m.cx(3), 0.001, m.cz(3)); const p2 = g._hintPoints();
    out.midHint = p2 && p2.length >= 3 && Math.hypot(p2[0].x - m.cx(3), p2[0].z - m.cz(3)) < 0.5;
    // carts kill
    out.carts = m.carts.length;
    if (m.carts.length) { const hz = m.carts[0].hz; g.player.teleport(hz.body.x, 0.001, hz.body.z); g._simulate(1 / 60); out.cartKills = g.state === 'dead'; }
    else out.cartKills = true;
    return out;
  });
  ok(r.solved, 'maze: it can be solved from the entrance to the exit');
  ok(r.doors >= 6 && r.decoys >= 1, `maze: revolving doors on the way (${r.doors}) and some on the way to nowhere (${r.decoys})`);
  ok(r.doorsCycle, 'maze: every revolving door alternates between blocking and open');
  ok(r.hintOn && r.hintLen >= 4 && r.hintEndsAtExit, `maze: the hint (H) draws the way to the exit (${r.hintLen} points)`);
  ok(r.midHint, 'maze: the hint works from the middle of the maze too');
  ok(r.cartKills, `maze: housekeeping carts hurt (${r.carts} on the route)`);
  await page.close();
}

// ---- Level 4: pause menu troll ----------------------------------------------------------------
{
  const page = await open(4);
  const r = await page.evaluate(() => {
    const g = window.__trust; g.state = 'playing'; g.pause();
    const b = document.getElementById('btn-resume');
    b.dispatchEvent(new MouseEvent('mouseenter'));
    const moved = b.style.transform !== '';
    for (let i = 0; i < 8; i++) b.dispatchEvent(new MouseEvent('mouseenter'));
    const settled = b.style.transform === '';
    g.resume();
    return { moved, settled, state: g.state };
  });
  ok(r.moved, 'Level 4: Resume button dodges the cursor');
  ok(r.settled, 'Level 4: ...but gives up after a few tries');
  ok(r.state === 'playing', 'Level 4: resume still works');
  await page.close();
}

await browser.close();
if (errs.length) { console.log('PAGE ERRORS:', errs.join('\n')); fails++; }
console.log(fails ? `\n${fails} FAILED` : '\nall game tests passed');
process.exit(fails ? 1 : 0);
