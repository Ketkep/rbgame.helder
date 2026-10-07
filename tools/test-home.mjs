// Home page tests (needs `vite preview` on :4173): the channel-surfing backdrop, the host, the gags, and the hand-off to a real level.
// Usage: node tools/test-home.mjs        SHOTS=/some/dir to also save screenshots
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const base = process.env.BASE || 'http://localhost:4173/';
const shots = process.env.SHOTS || '';
if (shots) fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const errs = [];

async function open(url, size = { width: 1280, height: 720 }, ctx = {}) {
  const context = await browser.newContext({ viewport: size, ...ctx });
  const page = await context.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__trust && window.__trust.backdrop && window.__trust.backdrop.i >= 0 && !window.__trust.backdrop.busy, null, { timeout: 120000, polling: 400 });
  return { context, page };
}

// ---- 1. desktop: the backdrop surfs through every level, the host talks ------------------------------------------------
{
  const { context, page } = await open(`${base}?debug`);
  const info = await page.evaluate(() => { const g = window.__trust, b = g.backdrop; return { shots: b.list.map((s) => s.id), caption: document.getElementById('bd-tag').textContent, state: g.state, campaign: g.campaign.id }; });
  ok(info.shots.length >= 7 && info.shots.includes('lobby') && info.shots.includes('ledge'), `desktop: ${info.shots.length} backdrop shots incl. the lobby and the ledge (${info.shots.join(', ')})`);
  ok(info.state === 'title' && /LEVEL 1/.test(info.caption), `desktop: it opens on the tutorial with a caption (${info.caption})`);
  await page.waitForFunction(() => document.getElementById('host-text').textContent.length > 8, null, { timeout: 15000 });
  ok(true, 'desktop: the host says hello');

  // force every cut and every shot to come round, twice; nothing may throw and the campaign must stay the tutorial's
  const mem0 = await page.evaluate(() => { const m = window.__trust.renderer.info.memory; return [m.geometries, m.textures]; });
  const seen = new Set(); let bad = '';
  for (let n = 0; n < 16; n++) {
    const r = await page.evaluate(async () => {
      const g = window.__trust, b = g.backdrop, shot = b.shot;
      b.t = shot.cuts[b.cut].dur + 0.01;                       // run out the clock on this cut
      await new Promise((res) => setTimeout(res, 900));
      for (let k = 0; k < 40 && b.busy; k++) await new Promise((res) => setTimeout(res, 200));
      return { id: b.shot?.id, campaign: g.campaign.id, speaking: !!(g.narrator.cur), world: !!g.world, state: g.state };
    });
    seen.add(r.id);
    if (r.campaign !== 'pilot' || r.speaking || !r.world || r.state !== 'title') bad = JSON.stringify(r);
  }
  ok(bad === '' && seen.size >= 4, `desktop: 16 cuts through ${seen.size} shots, campaign stays "pilot", the narrator never speaks (${bad || [...seen].join(', ')})`);
  // every single shot loads and frames something
  const each = await page.evaluate(async () => {
    const g = window.__trust, out = [];
    for (const s of g.backdrop.list) { const okk = await g.backdrop.preview(s.id, 0, 0); await new Promise((r) => setTimeout(r, 250)); out.push(`${s.id}:${okk && g.world && g.campaign.id === 'pilot' ? 'ok' : 'BAD'}`); }
    return out;
  });
  ok(each.every((x) => x.endsWith(':ok')) && each.length >= 7, `desktop: every backdrop shot builds (${each.join(' ')})`);
  await page.waitForTimeout(1200);
  const mem1 = await page.evaluate(() => { const m = window.__trust.renderer.info.memory; return [m.geometries, m.textures]; });
  ok(mem1[0] < mem0[0] + 900 && mem1[1] < mem0[1] + 120, `desktop: GPU memory stays bounded while surfing (${mem0.join('/')} -> ${mem1.join('/')})`);

  // the gags
  await page.evaluate(() => { document.getElementById('scr-home').classList.add('show'); });
  const skip = await page.$('[data-fx="skip"]');
  await skip.click(); await page.waitForTimeout(500);
  ok(/skip|tutorial|Press Play/i.test(await page.evaluate(() => document.getElementById('host-text').textContent)), 'gag: "Skip tutorial" gets a refusal from the host');
  for (let i = 0; i < 5; i++) { await page.click('#logo'); await page.waitForTimeout(80); }
  ok(await page.evaluate(() => document.getElementById('logo').classList.contains('flip')), 'gag: poking the logo five times flips it over');
  await page.evaluate(() => { document.getElementById('cookie').classList.remove('hidden'); });
  await page.click('#cookie-b'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.getElementById('cookie').classList.contains('hidden')), 'gag: either cookie button dismisses the banner');
  const d0 = await page.evaluate(() => document.getElementById('chip-deaths').textContent);
  await page.waitForTimeout(1600);
  ok(d0 !== await page.evaluate(() => document.getElementById('chip-deaths').textContent), 'gag: the "deaths today" counter ticks up');
  if (shots) await page.screenshot({ path: `${shots}/home-desktop.png` });

  // hand-off: Play starts a real level (the backdrop steps aside), quitting comes back to the backdrop
  await page.evaluate(() => window.__trust.backdrop.preview('l2', 0, 0));
  await page.evaluate(() => { window.__trust.audio.init(); });
  await page.click('.card.playable [data-fx="play"]');
  await page.waitForFunction(() => window.__trust.state === 'playing', null, { timeout: 60000 });
  const play = await page.evaluate(() => ({ lvl: window.__trust.level.name, idx: window.__trust.levelIndex, bd: window.__trust.backdrop.i, campaign: window.__trust.campaign.id }));
  ok(play.idx === 0 && play.bd === -1 && play.campaign === 'pilot', `play: Play starts level 1 and the backdrop stops (${play.lvl}, backdrop ${play.bd})`);
  await page.evaluate(() => window.__trust.toHome());
  await page.waitForFunction(() => window.__trust.state === 'title' && window.__trust.backdrop.i >= 0, null, { timeout: 60000 });
  ok(true, 'play: quitting to home brings the backdrop back');
  await context.close();
}

// ---- 2. entering the hotel while a hotel shot is loading must not break the hub ------------------------------------------------
{
  const { context, page } = await open(`${base}?debug`);
  const r = await page.evaluate(async () => {
    const g = window.__trust, b = g.backdrop;
    const i = b.list.findIndex((s) => s.id === 'lobby');
    const loading = b.load(i, false);                          // a hotel shot starts building ...
    await g.enterHub('hotel');                                  // ... and the player walks into the hotel at the same moment
    await loading;
    return { campaign: g.campaign.id, inHub: g.inHub, state: g.state, hasTiers: !!g.campaign.tiers };
  });
  ok(r.campaign === 'hotel' && r.inHub && r.hasTiers, `race: choosing the hotel mid-load still lands you in the lobby (${JSON.stringify(r)})`);
  await context.close();
}

// ---- 3. phone: no hotel shots, no host, same cards ---------------------------------------------------------------------------------
{
  const { context, page } = await open(`${base}?debug&touch`, { width: 844, height: 390 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const r = await page.evaluate(() => ({ shots: window.__trust.backdrop.list.map((s) => s.id), host: getComputedStyle(document.getElementById('host-wrap')).display, chips: getComputedStyle(document.getElementById('home-chips')).display, cards: document.querySelectorAll('#campaigns .card').length }));
  ok(!r.shots.includes('lobby') && !r.shots.includes('ledge') && r.shots.length === 5, `phone: only the five tutorial levels are used as backdrops (${r.shots.join(', ')})`);
  ok(r.host === 'none' && r.chips === 'none' && r.cards === 3, `phone: the host and the stat chips are hidden, the three cards are there`);
  if (shots) await page.screenshot({ path: `${shots}/home-phone.png` });
  await context.close();
}

await browser.close();
if (errs.length) { console.log('PAGE ERRORS:', [...new Set(errs)].join('\n')); fails++; }
console.log(fails ? `\n${fails} FAILED` : '\nall home tests passed');
process.exit(fails ? 1 : 0);
