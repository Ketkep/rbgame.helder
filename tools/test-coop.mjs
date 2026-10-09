// Campaign 3 netcode/logic test: two tabs of one browser linked over a BroadcastChannel (?loop). Needs `vite preview` on :4173.
import { chromium } from 'playwright-core';

const base = process.env.BASE || 'http://localhost:4173/';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 320, height: 180 } });
const code = 'T' + Math.random().toString(36).slice(2, 6).toUpperCase();
const open = async (mode, name) => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  await p.goto(`${base}?debug&loop&coop=${mode}&code=${code}&name=${name}`, { waitUntil: 'load' });
  return p;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = 60000;

const A = await open('host', 'Ann');
await sleep(500);
const B = await open('join', 'Bob');
await A.waitForFunction(() => window.__trust?.coop?.connected && window.__trust.coop.helloed, null, { timeout: T });
await B.waitForFunction(() => window.__trust?.coop?.connected && window.__trust.coop.helloed, null, { timeout: T });
ok(true, 'host and guest linked and said hello');
ok((await A.evaluate(() => window.__trust.coop.names.p2)) === 'Bob' && (await B.evaluate(() => window.__trust.coop.names.p1)) === 'Ann', 'names exchanged');

await A.evaluate(() => window.__trust.coop.startLevel(0));
for (const p of [A, B]) await p.waitForFunction(() => window.__trust.state === 'playing' && window.__trust.world && window.__trust.coop, null, { timeout: T });
ok(true, 'host picked level 1 and both started');
const info = (p) => p.evaluate(() => { const g = window.__trust; return { t: g.world.t, x: g.player.x, y: g.player.y, z: g.player.z, partner: { ...g.coop.partner }, rtt: g.coop.rtt, level: g.level.name }; });

// position stream
await A.evaluate(() => window.__trust.player.teleport(3, 0.01, -2));
await B.waitForFunction(() => Math.abs(window.__trust.coop.partner.sx - 3) < 0.3, null, { timeout: T }).catch(() => {});
let b = await info(B);
ok(Math.abs(b.partner.sx - 3) < 0.3 && Math.abs(b.partner.sz + 2) < 0.3, `partner avatar follows the other player (${b.partner.sx.toFixed(2)}, ${b.partner.sz.toFixed(2)})`);
ok(b.level === 'Icebreakers', 'both on the same level');
// clocks
const a0 = await info(A), b0 = await info(B);
ok(Math.abs(a0.t - b0.t) < 1.5, `world clocks within 1.5 s (${a0.t.toFixed(2)} vs ${b0.t.toFixed(2)})`);

// partner is a solid body: put B on A's head
await A.evaluate(() => window.__trust.player.teleport(0, 0.01, -3));
await sleep(900);
await B.evaluate(() => window.__trust.player.teleport(0, 1.9, -3));
await sleep(1200);
b = await info(B);
ok(b.y > 1.6 && b.y < 2.1, `you can stand on the partner's head (y=${b.y.toFixed(2)})`);

// both-plate: gate opens only when both stand on it, and goal needs both
const gateOpen = (p) => p.evaluate(() => { const bd = window.__trust.world.bodies.filter((x) => x.hx === 7 && x.hy === 2.5); return bd.length ? bd[0].enabled : null; });
await A.evaluate(() => window.__trust.player.teleport(-3, 0.01, -12));
await sleep(1000);
ok((await gateOpen(A)) === true, 'gate stays shut with one player on the plate');
await B.evaluate(() => window.__trust.player.teleport(-2.2, 0.01, -12));
for (const p of [A, B]) await p.waitForFunction(() => { const bd = window.__trust.world.bodies.filter((x) => x.hx === 7 && x.hy === 2.5); return bd.length && !bd[0].enabled; }, null, { timeout: T });
ok(true, 'gate opens on both machines when both stand on the plate');

// death rule 'self'
await A.evaluate(() => window.__trust.kill('void'));
await sleep(600);
ok((await B.evaluate(() => window.__trust.state)) === 'playing', "'self' rule: partner keeps playing when you die");
await A.waitForFunction(() => window.__trust.state === 'playing', null, { timeout: T });
await sleep(500);

// shared checkpoint
await A.evaluate(() => window.__trust.player.teleport(0, 0.01, -34));
await B.waitForFunction(() => Math.abs(window.__trust.world.respawn.z + 34) < 0.5, null, { timeout: T });
ok(true, "a checkpoint touched by one player saves it for both");

// 'both' rule
await Promise.all([A, B].map((p) => p.evaluate(() => { window.__trust.world.coopRules.deathRule = 'both'; })));
await A.evaluate(() => window.__trust.kill('void'));
await B.waitForFunction(() => window.__trust.state === 'dead', null, { timeout: T });
ok(true, "'both' rule: your partner goes back with you");
for (const p of [A, B]) await p.waitForFunction(() => window.__trust.state === 'playing', null, { timeout: T });

// 'revive' rule
await Promise.all([A, B].map((p) => p.evaluate(() => { window.__trust.world.coopRules.deathRule = 'revive'; })));
await A.evaluate(() => window.__trust.player.teleport(0, 0.01, -3));
await B.evaluate(() => window.__trust.player.teleport(3, 0.01, -3));
await sleep(600);
await A.evaluate(() => window.__trust.kill('void'));
await sleep(1500);
ok((await A.evaluate(() => window.__trust.state)) === 'dead', "'revive' rule: you stay down until your partner reaches you");
await B.evaluate(() => window.__trust.player.teleport(0.8, 0.01, -3));
await A.waitForFunction(() => window.__trust.state === 'playing', null, { timeout: T });
const pa = await A.evaluate(() => ({ x: window.__trust.player.x, z: window.__trust.player.z }));
ok(Math.hypot(pa.x - 0.8, pa.z + 3) < 3, `...and is pulled up next to them (${pa.x.toFixed(1)}, ${pa.z.toFixed(1)})`);
await Promise.all([A, B].map((p) => p.evaluate(() => { window.__trust.world.coopRules.deathRule = 'self'; })));

// goal needs both
await A.evaluate(() => window.__trust.player.teleport(0, 0.01, -40));
await sleep(1500);
ok((await B.evaluate(() => window.__trust.state)) === 'playing', 'one player on the goal is not enough');
await B.evaluate(() => window.__trust.player.teleport(1.2, 0.01, -40));
for (const p of [A, B]) await p.waitForFunction(() => window.__trust.state === 'complete', null, { timeout: T });
ok(true, 'both on the goal: level completes for both');
await sleep(2800);
const nextVis = await Promise.all([A, B].map((p) => p.evaluate(() => !document.getElementById('btn-next').classList.contains('hidden'))));
ok(nextVis[1] === false, 'only the host gets the Next button');

// partner leaving
await A.evaluate(() => window.__trust.coopUI.leave(false));
await B.waitForFunction(() => document.getElementById('scr-coop').classList.contains('show'), null, { timeout: 15000 });
ok(true, 'guest is told when the host leaves');

ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\ncoop tests passed');
process.exit(fails ? 1 : 0);
