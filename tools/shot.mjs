// Headless screenshot harness. Usage:
//   node tools/shot.mjs <outdir> <shotsJSON>
// shotsJSON: [{ name, level, tp:[x,y,z], yaw, pitch, wait, js }]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const outDir = process.argv[2] || '/tmp/shots';
const shots = JSON.parse(process.argv[3] || '[]');
const base = process.env.BASE || 'http://localhost:4173/';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const logs = [];
async function session(level) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  const url = base + (level ? `?debug&level=${level}` : '?debug');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__trust && window.__trust.world, null, { timeout: 30000 });
  return page;
}

let curKey = null, page = null;
try {
for (const s of shots) {
  const key = s.level || 0;
  if (key !== curKey) { if (page) await page.close(); page = await session(s.level); curKey = key; }
  if (s.js) await page.evaluate(s.js);
  if (s.tp) await page.evaluate(({ tp, yaw, pitch }) => {
    const g = window.__trust; g.player.teleport(tp[0], tp[1], tp[2]); g.yaw = yaw ?? g.yaw; g.pitch = pitch ?? 0;
  }, { tp: s.tp, yaw: s.yaw, pitch: s.pitch });
  await page.waitForTimeout(s.wait ?? 1500);
  await page.screenshot({ path: `${outDir}/${s.name}.png` });
  console.log('shot', s.name);
}
} catch (e) { console.log('ERROR', e.message); }
console.log(logs.length ? 'LOGS:\n' + [...new Set(logs)].join('\n') : 'no console errors');
await browser.close();
