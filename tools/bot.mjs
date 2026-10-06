// Plays a level with a simple waypoint bot to prove it is completable and the scripted beats fire.
// Usage: node tools/bot.mjs <level> [maxSimSeconds]
import { chromium } from 'playwright-core';

const level = +process.argv[2] || 1;
const maxSim = +process.argv[3] || 240;
const base = process.env.BASE || 'http://localhost:4173/';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
await page.addInitScript((n) => { window.__near = n; }, !!process.env.NEAR);
const errs = [];
page.on('pageerror', (e) => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
await page.goto(`${base}?debug&level=${level}${process.env.CAMPAIGN ? `&campaign=${process.env.CAMPAIGN}` : ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__trust && window.__trust.world && window.__trust.state === 'playing', null, { timeout: 60000 });

await page.evaluate(() => {
  const g = window.__trust;
  g.manual = true;
  const bot = (window.__bot = { i: 0, sim: 0, log: [], said: [] });
  const origSay = g.narrator.say.bind(g.narrator);
  g.narrator.say = (k, o) => { bot.said.push(String(k).slice(0, 40)); return origSay(k, o); };
  bot.step = (dt) => {
    const w = g.world, p = g.player;
    const path = w.plats.filter((q) => q.o.path);
    // whatever path platform we stand on, head for the next one (handles respawns too)
    if (p.grounded && p.ground) { const k = path.findIndex((q) => q.body === p.ground); if (k >= 0) bot.i = Math.min(path.length - 1, k + 1); }
    const tgt = path[Math.min(bot.i, path.length - 1)];
    let tx = tgt.body.x, tz = tgt.body.z;
    if (window.__near) {   // hop to the nearest part of the next platform (what a human does), not its centre
      const ix = Math.max(0.15, tgt.body.hx - 0.6), iz = Math.max(0.15, tgt.body.hz - 0.6);
      tx = Math.max(tgt.body.x - ix, Math.min(tgt.body.x + ix, p.x)); tz = Math.max(tgt.body.z - iz, Math.min(tgt.body.z + iz, p.z));
    }
    if (bot.i >= path.length - 1 && w.goalObj) { tx = w.goalObj.x; tz = w.goalObj.z; }
    // aim at the near part of the target platform to avoid over-running small ones
    const dx = tx - p.x, dz = tz - p.z, len = Math.hypot(dx, dz) || 1;
    g.yaw = Math.atan2(-dx, -dz); g.pitch = 0;
    g.keys.clear(); g.keys.add('KeyW');
    // wait for lasers: don't walk into an active hazard (or one about to fire) just ahead
    for (const h of w.hazards) {
      const hb = h.body;
      if (Math.max(hb.hx, hb.hz) > 4) continue;   // floor-sized hazards (wet floor, lava…) aren't lasers to wait for
      const ahead = (hb.x - p.x) * (dx / len) + (hb.z - p.z) * (dz / len);
      if (ahead > -0.5 && ahead < 2.6 && Math.abs(hb.y - p.y) < 2 && (h.enabled || (h.group.visible))) { g.keys.delete('KeyW'); break; }
    }
    // look-ahead: is there ground (or wall) ahead?
    const ax = p.x + (dx / len) * 0.55, az = p.z + (dz / len) * 0.55;
    let groundAhead = false, wallAhead = false;
    for (const b of w.bodies) {
      if (!b.enabled || !b.solid) continue;
      const over = ax > b.x - b.hx - 0.3 && ax < b.x + b.hx + 0.3 && az > b.z - b.hz - 0.3 && az < b.z + b.hz + 0.3;
      if (!over) continue;
      if (Math.abs(b.top - p.y) < 0.35) groundAhead = true;
      else if (b.top > p.y + 0.35 && b.top < p.y + 1.6) wallAhead = true;
    }
    // slippery marble: you can't stop or turn, so a human hops straight on (jump buffering) and steers in the air
    const gm = p.ground && (Math.abs(p.ground.dx) + Math.abs(p.ground.dz) > 1e-6);   // platform rolling away under us: go now
    const skate = p.grounded && p.ground && (((p.ground.slip > 0.8) && len < 4.4 && len > 3.0) || (gm && len < 4.4));
    const jump = p.grounded && (!groundAhead || wallAhead || skate);
    if (jump) g.jumpEdge = true;
    if (!p.grounded) g.keys.add('Space'); else if (jump) g.keys.add('Space');
    g.keys.add('Space'); // hold for full jumps; releasing happens naturally when we stop pressing in-air (kept simple)
    g._simulate(dt);
    w.hooks.frame?.(dt, g);
    if (g.ui._creditsOn && g.ui.creditsUpdate(dt)) w.hooks.onCreditsEnd?.();
    bot.sim += dt;
    if (window.__trace && bot.i >= window.__trace && Math.floor(bot.sim * 10) !== bot._lt) { bot._lt = Math.floor(bot.sim * 10); bot.log.push([+bot.sim.toFixed(1), +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +p.vx.toFixed(1), +p.vz.toFixed(1), p.grounded ? 1 : 0, g.state]); }
  };
});

if (process.env.TRACE) await page.evaluate((t) => { window.__trace = t; }, +process.env.TRACE);
let done = false, lastLog = 0;
while (!done) {
  const r = await page.evaluate(() => {
    const g = window.__trust, b = window.__bot;
    for (let k = 0; k < 90 && g.state === 'playing'; k++) b.step(1 / 60);
    const p = g.player;
    return { state: g.state, sim: +b.sim.toFixed(1), x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1), wp: b.i, deaths: g.deaths, frozen: g.frozen };
  });
  if (r.sim - lastLog >= 15) { console.log(JSON.stringify(r)); lastLog = r.sim; }
  if (r.state === 'complete' || r.state === 'ended') { console.log('COMPLETED', JSON.stringify(r)); done = true; }
  else if (r.sim > maxSim) { console.log('TIMEOUT', JSON.stringify(r)); done = true; }
  else if (r.state !== 'playing' || r.frozen) await page.waitForTimeout(250);
}
if (process.env.TRACE) console.log((await page.evaluate(() => window.__bot.log.slice(0, 160))).map((r) => r.join(' ')).join('\n'));
const said = await page.evaluate(() => window.__bot.said);
console.log('narrator beats:', [...new Set(said)].join(', '));
if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
await browser.close();
