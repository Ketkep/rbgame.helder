// Touch-control tests (needs `vite preview` on :4173). Emulates a phone (landscape) and drives the on-screen controls with real
// multi-touch events through the DevTools protocol. Usage: node tools/test-touch.mjs        SHOTS=/some/dir to also save screenshots
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
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function phone(url, size = { width: 844, height: 390 }) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: IPHONE });
  const page = await context.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url, { waitUntil: 'load' });
  const cdp = await context.newCDPSession(page);
  const t = {
    pts: new Map(),
    async send(type) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...t.pts].map(([id, p]) => ({ x: p.x, y: p.y, id })) }); },
    async down(id, x, y) { t.pts.set(id, { x, y }); await t.send('touchStart'); },
    async move(id, x, y) { t.pts.set(id, { x, y }); await t.send('touchMove'); },
    async up(id) { const p = t.pts.get(id); t.pts.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: p.x, y: p.y, id }] }); },   // touchEnd lists only the finger that lifted
  };
  return { context, page, t };
}
const centre = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
const playing = (page) => page.waitForFunction(() => window.__trust && window.__trust.state === 'playing' && window.__trust.world, null, { timeout: 90000, polling: 400 });
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };

// ---- 1. the home page on a phone: no "desktop only" wall, touch wording, hotel marked desktop-only ---------------------
{
  const { context, page } = await phone(base);
  await page.waitForSelector('#campaigns .card', { timeout: 60000 });
  const info = await page.evaluate(() => ({
    touch: document.body.classList.contains('touch'),
    mobileScreen: !!document.getElementById('scr-mobile'),
    cards: [...document.querySelectorAll('#campaigns .card')].map((c) => ({ title: c.querySelector('h3')?.textContent, btns: [...c.querySelectorAll('button')].map((b) => b.textContent), badge: c.querySelector('.soon-badge')?.textContent || '' })),
    keys: document.querySelector('.home .keys')?.textContent || '',
    homeShown: document.getElementById('scr-home').classList.contains('show'),
  }));
  ok(info.touch && info.homeShown && !info.mobileScreen, 'phone: the home page shows (no "desktop only" wall)');
  ok(info.cards[0].btns.includes('Play') || info.cards[0].btns.includes('Continue'), `phone: Campaign 1 can be played (${info.cards[0].btns.join(', ')})`);
  ok(info.cards.some((c) => /Desktop only/.test(c.badge)) && info.cards.every((c) => !/Enter the hotel|lobby/.test(c.btns.join(' '))), `phone: the hotel is marked desktop-only (${info.cards.map((c) => c.badge || c.btns[0]).join(' | ')})`);
  ok(/thumb/i.test(info.keys) && !/WASD/.test(info.keys), 'phone: the home page explains thumbs, not WASD');
  await shot(page, '1-home');
  await context.close();
}

// ---- 2. playing: stick, look, jump, two thumbs at once, pause ---------------------------------------------------------------
{
  const { context, page, t } = await phone(`${base}?debug&touch&level=1`);
  await playing(page);
  await page.waitForTimeout(1500);
  ok(await page.evaluate(() => document.getElementById('touch').classList.contains('show')), 'play: the touch controls are on screen');
  await shot(page, '2-play');

  const z0 = await page.evaluate(() => window.__trust.player.z);
  const stick = { x: 110, y: 300 };
  await t.down(1, stick.x, stick.y);
  await t.move(1, stick.x, stick.y - 70);           // thumb pushed up = forward
  await page.waitForTimeout(1500);
  const mv = await page.evaluate(() => ({ y: window.__trust.touchMove.y, x: window.__trust.touchMove.x, z: window.__trust.player.z }));
  ok(mv.y > 0.9 && Math.abs(mv.x) < 0.05, `stick: pushing up is full forward (${mv.y.toFixed(2)}, ${mv.x.toFixed(2)})`);
  ok(mv.z < z0 - 0.5, `stick: you actually walk forward (z ${z0.toFixed(2)} -> ${mv.z.toFixed(2)})`);
  await shot(page, '3-stick');

  // right thumb drags to look, while the left thumb keeps walking
  const yaw0 = await page.evaluate(() => window.__trust.yaw);
  await t.down(2, 620, 200);
  await t.move(2, 720, 200);
  await page.waitForTimeout(150);
  const yaw1 = await page.evaluate(() => window.__trust.yaw);
  ok(yaw1 < yaw0 - 0.3 && (await page.evaluate(() => window.__trust.touchMove.y)) > 0.9, `look: dragging right turns right (${(yaw1 - yaw0).toFixed(2)} rad) while still walking`);
  await t.up(2);

  // jump with a third touch while walking
  const jump = await centre(page, '#t-jump');
  await page.evaluate(() => { window.__maxVy = 0; window.__iv = setInterval(() => { window.__maxVy = Math.max(window.__maxVy, window.__trust.player.vy); }, 8); });
  await t.down(3, jump.x, jump.y);
  const held = await page.evaluate(() => window.__trust.keys.has('Space'));
  await page.waitForTimeout(500);
  await t.up(3);
  const after = await page.evaluate(() => ({ vy: window.__maxVy, space: window.__trust.keys.has('Space'), walking: window.__trust.touchMove.y }));
  ok(held && !after.space, 'jump: the button holds Space while pressed and lets go');
  ok(after.vy > 4, `jump: pressing JUMP jumps (peak vy ${after.vy.toFixed(1)})`);
  ok(after.walking > 0.9, 'jump: the stick kept going while the other thumb jumped');
  await t.up(1);
  await page.waitForTimeout(200);
  ok((await page.evaluate(() => Math.hypot(window.__trust.touchMove.x, window.__trust.touchMove.y))) === 0, 'stick: letting go stops you');

  // pause button, and the pause screen can be tapped
  const pb = await centre(page, '#t-pause');
  await t.down(4, pb.x, pb.y); await t.up(4);
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => window.__trust.state === 'paused' && !document.getElementById('touch').classList.contains('show')), 'pause: the ❚❚ button pauses and hides the controls');
  await shot(page, '4-pause');
  const rb = await centre(page, '#btn-resume');
  await t.down(5, rb.x, rb.y); await t.up(5);
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => window.__trust.state === 'playing'), 'pause: tapping Resume resumes');

  // respawn button
  await page.evaluate(() => { window.__trust.player.teleport(0, 0, -5); });
  const rs = await centre(page, '#t-reset');
  await t.down(6, rs.x, rs.y); await t.up(6);
  await page.waitForTimeout(800);
  ok(await page.evaluate(() => window.__trust.player.z > -2), 'respawn: the ↺ button puts you back at the start');

  // the baby-mode offer is tappable
  await page.evaluate(() => { const g = window.__trust; g.babyOfferShown = true; g.ui.babyOffer(true); });
  const bo = await centre(page, '#baby-offer');
  await t.down(7, bo.x, bo.y); await t.up(7);
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__trust.baby === true), 'baby mode: tapping the offer accepts it');

  // portrait: pause + the "turn your phone" cover
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  const por = await page.evaluate(() => ({ state: window.__trust.state, cover: getComputedStyle(document.getElementById('scr-rotate')).display }));
  ok(por.state === 'paused' && por.cover !== 'none', `portrait: the game pauses and asks you to turn the phone (${por.state}, ${por.cover})`);
  await shot(page, '5-portrait');
  await context.close();
}

// ---- 3. tutorial wording on a phone; level 4's pause button dodges a thumb -----------------------------------------------------
{
  const { context, page, t } = await phone(`${base}?debug&touch&level=1`);
  await playing(page);
  const lines = await page.evaluate(() => {
    const n = window.__trust.narrator;
    return { look: n.resolve('l1.look').text, move: n.resolve('l1.move').text, jump: n.resolve('l1.gap.intro').text, other: n.resolve('l1.walk').text };
  });
  ok(/finger|drag/i.test(lines.look) && /thumb/i.test(lines.move) && /JUMP button/.test(lines.jump) && !/mouse|WASD|SPACE/i.test(lines.look + lines.move + lines.jump), 'tutorial: the lines talk about thumbs and the JUMP button');
  ok(/natural/i.test(lines.other), 'tutorial: other lines are unchanged');
  await page.evaluate(() => { window.__trust.ui.prompt([{ label: 'W', code: 'KeyW' }], 'to move'); });
  ok(await page.evaluate(() => /STICK/.test(document.getElementById('prompt').textContent)), 'tutorial: the on-screen prompt says STICK, not W A S D');
  await context.close();
  const l4 = await phone(`${base}?debug&touch&level=4`);
  await playing(l4.page);
  await l4.page.waitForTimeout(800);
  const pb = await centre(l4.page, '#t-pause');
  await l4.t.down(1, pb.x, pb.y); await l4.t.up(1);
  await l4.page.waitForTimeout(700);
  const r0 = await centre(l4.page, '#btn-resume');
  await l4.t.down(2, r0.x, r0.y); await l4.t.up(2);
  await l4.page.waitForTimeout(500);
  const dodged = await l4.page.evaluate(() => ({ state: window.__trust.state, tf: document.getElementById('btn-resume').style.transform }));
  ok(dodged.state === 'paused' && /translate/.test(dodged.tf), `level 4: the Resume button slides away from a thumb (${dodged.tf})`);
  await l4.context.close();
}

await browser.close();
if (errs.length) { console.log('PAGE ERRORS:', [...new Set(errs)].join('\n')); fails++; }
console.log(fails ? `\n${fails} FAILED` : '\nall touch tests passed');
process.exit(fails ? 1 : 0);
