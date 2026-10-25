// Lowtide screenshots (real render, 1280x720): BASE=http://localhost:PORT/ node tools/lt-shot.mjs <chapter> '<json [[x,y,z,yawDeg,pitchDeg,name],...]>' -> /tmp/shots/LT<ch>-<name>.png (real render, 1280x720)
import { chromium } from 'playwright-core';
const ch = +process.argv[2] || 1; const views = JSON.parse(process.argv[3] || '[[0,0,2.5,0,0,"start"]]');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const code = 'L' + Math.random().toString(36).slice(2, 6).toUpperCase(); const errs = [];
const open = async (m, n) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(n + ': ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', (x) => { if (x.type() === 'error') errs.push(n + ' console: ' + x.text().slice(0, 200)); }); await p.goto(`${process.env.BASE || 'http://localhost:4190/'}?debug&loop&coop=${m}&camp=lowtide&code=${code}&name=${n}`); return p; };
const A = await open('host', 'Ann'); await new Promise((r) => setTimeout(r, 400)); const B = await open('join', 'Bob');
for (const p of [A, B]) await p.waitForFunction(() => window.__trust?.coop?.connected && window.__trust.coop.helloed, null, { timeout: 60000 });
await A.evaluate((i) => window.__trust.coop.startLevel(i), ch - 1);
for (const p of [A, B]) await p.waitForFunction(() => window.__trust.state === 'playing' && window.__trust.world, null, { timeout: 120000 }).catch((e) => errs.push('never playing ' + e.message.slice(0, 60)));
await new Promise((r) => setTimeout(r, 4000));
for (const [x, y, z, yaw, pitch, name, js, delay] of views) {
  await A.evaluate(([x, y, z, yaw, pitch]) => { const g = window.__trust; g.player.x = x; g.player.y = y; g.player.z = z; g.player.vx = g.player.vy = g.player.vz = 0; g.yaw = yaw * Math.PI / 180; g.pitch = pitch * Math.PI / 180; }, [x, y, z, yaw, pitch]);
  await new Promise((r) => setTimeout(r, 2500));
  if (js) { await A.evaluate((code) => { const w = window.__trust.world; return eval(code); }, js); await new Promise((r) => setTimeout(r, delay || 300)); }
  await A.screenshot({ path: `/tmp/shots/LT${ch}-${name}.png` });
}
console.log('errors:', errs.slice(0, 6));
await browser.close();
