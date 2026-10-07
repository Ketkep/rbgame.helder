// Smoke test for every hotel level: load it, play 6 s, die and respawn a few times, then unload by loading the next one.
// Reports page errors and (roughly) leaked GPU resources. Needs `vite preview` on :4173.
import { chromium } from 'playwright-core';

const base = process.env.BASE || 'http://localhost:4173/';
const from = +process.argv[2] || 1, to = +process.argv[3] || 15;
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.split('\n')[0]));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
await page.goto(`${base}?debug&campaign=hotel&level=${from}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__trust && window.__trust.world && window.__trust.state === 'playing', null, { timeout: 60000 });
await page.evaluate(() => { window.__trust.manual = true; });
let fails = 0;
for (let lv = from; lv <= to; lv++) {
  const before = errs.length;
  if (lv !== from) {
    await page.evaluate(async (i) => { const g = window.__trust; await g.loadLevel(i - 1); g.state = 'playing'; g.manual = true; g.respawnPlayer(true); }, lv);
    await page.waitForFunction(() => window.__trust.world && window.__trust.state === 'playing', null, { timeout: 60000 });
  }
  const r = await page.evaluate(() => {
    const g = window.__trust, w = g.world, out = { name: g.level.name };
    const sim = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { g._simulate(1 / 60); w.hooks.frame?.(1 / 60, g); } };
    sim(6);
    for (let k = 0; k < 3; k++) { g.kill('test'); g.state = 'playing'; g.respawnPlayer(false); sim(1.5); }
    // hints, pause/resume, manual reset must not throw
    g.debug = false; g.hintCool = 0; g.useHint(); sim(0.5);
    g.manualReset(); sim(0.5);
    out.mem = g.renderer.info.memory.geometries + '/' + g.renderer.info.memory.textures;
    out.state = g.state;
    return out;
  });
  const e = errs.slice(before);
  const bad = e.length > 0 || r.state !== 'playing';
  if (bad) fails++;
  console.log(`${bad ? 'FAIL' : 'ok  '} L${lv} ${r.name}  gpu(geo/tex)=${r.mem}${e.length ? '  errors: ' + [...new Set(e)].join(' | ') : ''}`);
}
await browser.close();
console.log(fails ? `\n${fails} level(s) with problems` : '\nall levels clean');
process.exit(fails ? 1 : 0);
