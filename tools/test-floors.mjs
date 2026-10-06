// In-browser logic tests for the hotel's floors 2 and 3 (needs `vite preview` on :4173). Usage: node tools/test-floors.mjs [name-filter]
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

const names = Object.keys(suites).filter((n) => n.includes(filter));
for (const n of names) { console.log(`\n== ${n}`); await suites[n](); }
await browser.close();
if (errs.length) { console.log('PAGE ERRORS:', errs.join('\n')); fails++; }
console.log(fails ? `\n${fails} FAILED` : '\nall floor tests passed');
process.exit(fails ? 1 : 0);
