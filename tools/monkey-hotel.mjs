// Monkey test: random keys, jumps, looks, E/H presses and deaths in every hotel level; reports any page error.
import { chromium } from 'playwright-core';
const base = process.env.BASE || 'http://localhost:4173/';
const from = +process.argv[2] || 1, to = +process.argv[3] || 15, secs = +process.argv[4] || 45;
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
const errs = [];
page.on('pageerror', (e) => errs.push((e.stack || e.message).split('\n').slice(0, 3).join(' <- ')));
await page.goto(`${base}?debug&campaign=hotel&level=${from}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__trust && window.__trust.world && window.__trust.state === 'playing', null, { timeout: 60000 });
let fails = 0;
for (let lv = from; lv <= to; lv++) {
  const before = errs.length;
  if (lv !== from) {
    await page.evaluate(async (i) => { const g = window.__trust; await g.loadLevel(i - 1); g.state = 'playing'; g.respawnPlayer(true); }, lv);
    await page.waitForFunction(() => window.__trust.world && window.__trust.state === 'playing', null, { timeout: 60000 });
  }
  const r = await page.evaluate((secs) => {
    const g = window.__trust, w = g.world; g.manual = true;
    const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'];
    let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const frames = secs * 60; let kills = 0, uses = 0;
    for (let f = 0; f < frames; f++) {
      if (f % 20 === 0) { g.keys.clear(); for (const k of keys) if (rnd() < (k === 'KeyW' ? 0.7 : 0.25)) g.keys.add(k); if (g.keys.has('Space')) g.jumpEdge = true; }
      if (f % 15 === 0) { g.yaw += (rnd() - 0.5) * 1.6; g.pitch = Math.max(-1, Math.min(1, g.pitch + (rnd() - 0.5) * 0.4)); }
      if (f % 45 === 0 && rnd() < 0.5) { try { g.useFocus?.(); } catch (e) { throw e; } uses++; }
      if (f % 300 === 0 && rnd() < 0.5) { g.debug = false; g.hintCool = 0; g.useHint(); }
      if (g.modal && f % 30 === 0) { const codes = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Enter', 'KeyE', 'Backspace']; g.modal.key({ code: codes[Math.floor(rnd() * codes.length)] }); }
      if (g.state === 'dead') { g.state = 'playing'; g.respawnPlayer(false); kills++; }
      if (g.state !== 'playing') { g.state = 'playing'; }
      g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g);
      if (rnd() < 0.0008) { g.kill('monkey'); }
    }
    g.keys.clear();
    return { name: g.level.name, state: g.state, kills };
  }, secs);
  const e = errs.slice(before);
  if (e.length) fails++;
  console.log(`${e.length ? 'FAIL' : 'ok  '} L${lv} ${r.name} (${r.kills} deaths)${e.length ? '\n   ' + [...new Set(e)].join('\n   ') : ''}`);
}
await browser.close();
console.log(fails ? `\n${fails} level(s) threw errors` : '\nno errors');
process.exit(fails ? 1 : 0);
