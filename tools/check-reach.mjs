// Verifies every consecutive pair of path platforms is jumpable with the real movement numbers.
// Usage: node tools/check-reach.mjs [levels...]   (needs `vite preview` on :4173)
import { chromium } from 'playwright-core';
import { reach } from '../src/engine/physics.js';

const levels = process.argv.slice(2).map(Number);
if (!levels.length) levels.push(1, 2, 3, 4, 5);
const base = process.env.BASE || 'http://localhost:4173/';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
let bad = 0;
for (const lv of levels) {
  const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
  await page.goto(`${base}?debug&level=${lv}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__trust && window.__trust.world && window.__trust.state === 'playing', null, { timeout: 60000 });
  const data = await page.evaluate(() => {
    const w = window.__trust.world;
    const path = w.plats.filter((p) => p.o.path);
    return path.map((p) => {
      const mv = w.movers.find((m) => m.plat === p);
      const b = p.base;
      const samples = [];
      if (mv) for (let t = 0; t < 16; t += 0.1) { const o = mv.fn(t); samples.push([b.x + (o.x || 0), b.y + (o.y || 0), b.z + (o.z || 0)]); }
      else samples.push([b.x, b.y, b.z]);
      return { hx: p.body.hx, hy: p.body.hy, hz: p.body.hz, samples, mover: !!mv, crumble: false };
    });
  });
  let worst = 0, hard = 0, impossible = 0, n = 0;
  const notes = [];
  for (let i = 1; i < data.length; i++) {
    const A = data[i - 1], B = data[i];
    const T = Math.max(A.samples.length, B.samples.length);
    let minGap = Infinity, maxGap = 0, dh = 0;
    for (let s = 0; s < T; s++) {
      const a = A.samples[Math.min(s, A.samples.length - 1)], b = B.samples[Math.min(s, B.samples.length - 1)];
      const gx = Math.max(0, Math.abs(a[0] - b[0]) - (A.hx + B.hx)), gz = Math.max(0, Math.abs(a[2] - b[2]) - (A.hz + B.hz));
      const g = Math.hypot(gx, gz);
      minGap = Math.min(minGap, g); maxGap = Math.max(maxGap, g);
      dh = (b[1] + B.hy) - (a[1] + A.hy);
    }
    const r = reach(dh);
    const limit = r + 0.45;       // AABB edge forgiveness (conservative)
    const comfy = r * 0.9 + 0.1;
    n++;
    if (dh > 1.3 || minGap > limit) { impossible++; notes.push(`  IMPOSSIBLE #${i}: gap ${minGap.toFixed(2)} dh ${dh.toFixed(2)} (reach ${r.toFixed(2)})`); }
    else if (minGap > comfy) { hard++; notes.push(`  hard #${i}: gap ${minGap.toFixed(2)} dh ${dh.toFixed(2)} (reach ${r.toFixed(2)})${A.mover || B.mover ? ' [mover]' : ''}`); }
    worst = Math.max(worst, minGap / Math.max(0.1, r));
  }
  console.log(`Level ${lv}: ${data.length} path platforms, ${n} hops, ${hard} hard, ${impossible} impossible`);
  notes.slice(0, 40).forEach((s) => console.log(s));
  bad += impossible;
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
