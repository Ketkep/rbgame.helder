// GPU leak test (needs `vite preview` on :4173): bounce between the hotel lobby and level 1 and check that the renderer's
// geometry / texture counts come back to the same numbers every time. Usage: node tools/test-leak.mjs [rounds]
import { chromium } from 'playwright-core';

const base = process.env.BASE || 'http://localhost:4173/';
const rounds = +(process.argv[2] || 4);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${base}?debug&campaign=hotel`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__trust && window.__trust.world && window.__trust.state === 'playing', null, { timeout: 120000, polling: 500 });
const rows = await page.evaluate(async (n) => {
  const g = window.__trust; g.manual = true;
  const settle = () => new Promise((r) => setTimeout(r, 1500));            // let a frame render so the counts are real
  const mem = () => { const m = g.renderer.info.memory; return [m.geometries, m.textures]; };
  const out = { hub: [], level: [] };
  for (let i = 0; i < n; i++) {
    await g.loadLevel(0); g.state = 'playing'; for (let k = 0; k < 30; k++) g._simulate(1 / 60); await settle(); out.level.push(mem());
    await g._loadLevelObj(g.campaign.hub, -1); g.state = 'playing'; for (let k = 0; k < 90; k++) g._simulate(1 / 60); await settle(); out.hub.push(mem());
  }
  return out;
}, rounds);
let fails = 0;
for (const k of ['hub', 'level']) {
  const [g0, t0] = rows[k][0], [g1, t1] = rows[k][rows[k].length - 1];
  const ok = g1 <= g0 && t1 <= t0;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${k}: geometries/textures per round ${rows[k].map((r) => r.join('/')).join('  ')}`);
}
if (errs.length) { console.log('PAGE ERRORS:', errs.join('\n')); fails++; }
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nno GPU leak');
process.exit(fails ? 1 : 0);
