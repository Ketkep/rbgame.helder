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

async function open(level) {
  const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}?debug&level=${level}`, { waitUntil: 'load' });
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
    pips: [...document.querySelectorAll('.card.playable .pip')].map((p) => p.className.replace('pip ', '')),
  }));
  ok(r.cards === 3 && r.playable === 1 && r.soon === 2, `home shows 1 playable + 2 coming-soon campaigns (${r.playable}/${r.soon})`);
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
