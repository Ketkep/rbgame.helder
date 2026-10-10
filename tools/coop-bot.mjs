// Plays a Campaign 3 level with TWO bots (two tabs linked over a BroadcastChannel) to prove it is completable.
// Usage: node tools/coop-bot.mjs <levelNumber 1-10> [maxSimSeconds=900] [speed=3]
// Levels steer their bots with w.botPlan (see botSteps() in src/levels/coop/kit.js); otherwise the bots walk the path:true platforms.
import { chromium } from 'playwright-core';

const level = (+process.argv[2] || 1) - 1;
const maxSim = +process.argv[3] || 900;
const speed = +process.argv[4] || 3;
const base = process.env.BASE || 'http://localhost:4173/';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'],
});
const ctx = await browser.newContext({ viewport: { width: 160, height: 90 } });
await ctx.addInitScript((o) => { window.__noRender = true; window.__near = true; window.__speed = o.speed; }, { speed });
const code = 'B' + Math.random().toString(36).slice(2, 6).toUpperCase();
const errs = [];
const open = async (mode, name) => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
  await p.goto(`${base}?debug&loop&coop=${mode}&code=${code}&name=${name}`, { waitUntil: 'load' });
  return p;
};
const A = await open('host', 'Ann');
await new Promise((r) => setTimeout(r, 400));
const B = await open('join', 'Bob');
for (const p of [A, B]) await p.waitForFunction(() => window.__trust?.coop?.connected && window.__trust.coop.helloed, null, { timeout: 60000 });
await A.evaluate((i) => window.__trust.coop.startLevel(i), level);
setTimeout(() => { if (errs.length) console.log("EARLY ERR", errs[0]); }, 15000);
for (const p of [A, B]) await p.waitForFunction(() => window.__trust.state === 'playing' && window.__trust.world && window.__trust.coop, null, { timeout: 90000 });

const install = () => {
  const g = window.__trust;
  g.manual = true;
  if (!window.__shove) g.world.coopRules.shove = 0;      // bots lean on each other constantly; shoving is for humans
  const bot = (window.__bot = { i: 0, sim: 0, said: [], log: [] });
  const origSay = g.narrator.say.bind(g.narrator);
  g.narrator.say = (k, o) => { bot.said.push(String(k).slice(0, 48)); return origSay(k, o); };
  const origKill = g.kill.bind(g);
  g.kill = (r, f) => { const q = g.player; bot.log.push(`${bot.sim.toFixed(0)}s died (${r}${f ? ', partner' : ''}) at ${q.x.toFixed(1)},${q.y.toFixed(1)},${q.z.toFixed(1)}`); return origKill(r, f); };
  bot.step = (dt) => {
    const w = g.world, p = g.player, c = g.coop, me = c.me;
    if (g.modal) g.closeModal();
    const path = w.plats.filter((q) => q.o.path === true || q.o.path === me);
    if (p.grounded && p.ground) { const k = path.findIndex((q) => q.body === p.ground); if (k >= 0) bot.i = Math.min(path.length - 1, k + 1); }
    const plan = w.botPlan ? w.botPlan(g) : null;
    const tgt = plan ? { body: plan.body || { x: plan.x, z: plan.z, hx: 0, hz: 0 } } : path[Math.min(bot.i, path.length - 1)];
    let tx = tgt.body.x, tz = tgt.body.z;
    if (!plan) {
      const ix = Math.max(0.15, tgt.body.hx - 0.6), iz = Math.max(0.15, tgt.body.hz - 0.6);
      tx = Math.max(tgt.body.x - ix, Math.min(tgt.body.x + ix, p.x)); tz = Math.max(tgt.body.z - iz, Math.min(tgt.body.z + iz, p.z));
      if (p.grounded && p.ground && p.ground !== tgt.body && Math.abs(tgt.body.top - p.ground.top) < 1.5) {       // platforms touching edge to edge: slide along the ground until lined up with the shared edge, then cross it (no corner cutting over the void)
        const G = p.ground, T = tgt.body;
        const ox0 = Math.max(G.x - G.hx, T.x - T.hx), ox1 = Math.min(G.x + G.hx, T.x + T.hx), oz0 = Math.max(G.z - G.hz, T.z - T.hz), oz1 = Math.min(G.z + G.hz, T.z + T.hz);
        const cl = (v, a, b) => Math.max(a, Math.min(b, v));
        if (Math.abs(Math.abs(G.z - T.z) - (G.hz + T.hz)) < 0.15 && ox1 - ox0 > 1.0) {
          tx = cl(p.x, ox0 + 0.6, ox1 - 0.6);
          tz = p.x < ox0 + 0.35 || p.x > ox1 - 0.35 ? p.z : T.z;
        } else if (Math.abs(Math.abs(G.x - T.x) - (G.hx + T.hx)) < 0.15 && oz1 - oz0 > 1.0) {
          tz = cl(p.z, oz0 + 0.6, oz1 - 0.6);
          tx = p.z < oz0 + 0.35 || p.z > oz1 - 0.35 ? p.x : T.x;
        }
      }
      if (Math.hypot(tx - p.x, tz - p.z) < 0.3) { tx = tgt.body.x; tz = tgt.body.z; }          // already over it (overlapping platforms): head for its middle
      if (bot.i >= path.length - 1 && w.goalObj) { tx = w.goalObj.x; tz = w.goalObj.z; }
    }
    const dx = tx - p.x, dz = tz - p.z, len = Math.hypot(dx, dz) || 1;
    if (len > 0.05) { g.yaw = Math.atan2(-dx, -dz); }
    g.pitch = 0;
    g.keys.clear();
    let wait = !!(plan && plan.wait);
    // on a rope: don't run ahead of your partner
    const T = c._tether;
    if (!plan && T && T.on && c.partner.has) { const d = Math.hypot(c.partner.sx - p.x, c.partner.sz - p.z); if (d > T.max - 2.2 && Math.hypot(tx - c.partner.sx, tz - c.partner.sz) < len) wait = true; }
    // ferries and lifts: board when it is at the edge, get off when the far side is at the edge
    if (!plan && p.grounded && !wait) {
      const gapTo = (b) => Math.hypot(Math.max(0, Math.abs(p.x - b.x) - b.hx), Math.max(0, Math.abs(p.z - b.z) - b.hz));
      const onMover = p.ground && w.movers.some((m) => m.plat.body === p.ground);
      const toMover = tgt.body && w.movers.some((m) => m.plat === tgt);
      const dy = tgt.body.top - p.y;
      let edgeT = Infinity;                                          // metres until I walk off the platform I'm standing on, heading for the target
      if (p.ground) { const gb = p.ground; for (const [pos, c, h, u] of [[p.x, gb.x, gb.hx, dx / len], [p.z, gb.z, gb.hz, dz / len]]) if (Math.abs(u) > 1e-6) edgeT = Math.min(edgeT, ((u > 0 ? c + h : c - h) - pos) / u); }
      if ((onMover || toMover) && edgeT < 1.4 && (gapTo(tgt.body) - edgeT > 1.6 || dy > 1.0 || dy < -3)) wait = true;
    }
    if (!wait && !(plan && plan.jump && !p.grounded && len < (plan.stop ?? 0.9))) g.keys.add('KeyW');       // hop-onto-a-head: stop pushing once over it
    const T0 = w.t, ux = dx / len, uz = dz / len;
    let hold = false, hop = false;
    for (const h of w.hazards) {
      const hb = h.body;
      if (Math.max(hb.hx, hb.hz) > 4 && !h.predict && !h.jumpable) continue;
      if (!p.grounded) continue;
      const ahead = (hb.x - p.x) * ux + (hb.z - p.z) * uz;
      if (h.jumpable) { if (ahead > 0.2 && ahead < 2.7 && Math.abs(hb.y - p.y) < 2 && Math.hypot(hb.x - p.x, hb.z - p.z) < 3.6) hop = true; continue; }
      if (ahead < -2.5 || ahead > 7) continue;
      let bad = false;
      for (const tau of [0.15, 0.4, 0.65]) {
        let hx = hb.x, hy = hb.y, hz = hb.z;
        if (h.move) { const o = h.move(T0 + tau), b0 = h.base; hx = b0.x + (o.x || 0); hy = b0.y + (o.y || 0); hz = b0.z + (o.z || 0); }
        const en = h.predict ? h.predict(T0 + tau) : (h.enabled || h.group.visible);
        if (!en) continue;
        const rx = hx - p.x, rz = hz - p.z, al = rx * ux + rz * uz, lat = Math.abs(rx * uz - rz * ux), r = Math.max(hb.hx, hb.hz);
        if (Math.hypot(rx, rz) < r + 0.4) continue;
        if (al > -1.0 && al < Math.min(len, 6) + 1 && lat < r + 0.7 && Math.abs(hy - p.y) < hb.hy + 2.4) bad = true;
      }
      if (bad) { hold = true; break; }
    }
    if (hold) g.keys.delete('KeyW');
    const ax = p.x + ux * 0.55, az = p.z + uz * 0.55;
    let groundAhead = false, wallAhead = false;
    for (const b of w.bodies) {
      if (!b.enabled || !b.solid || b.tag === 'partner' && false) continue;
      const over = ax > b.x - b.hx - 0.3 && ax < b.x + b.hx + 0.3 && az > b.z - b.hz - 0.3 && az < b.z + b.hz + 0.3;
      if (!over) continue;
      if (Math.abs(b.top - p.y) < 0.35) groundAhead = true;
      else if (b.top > p.y + 0.35 && b.top < p.y + 1.6) wallAhead = true;
    }
    const gm = p.ground && (Math.abs(p.ground.dx) + Math.abs(p.ground.dz) > 1e-6);
    const vproj = (p.vx * dx + p.vz * dz) / len;
    if (!p.grounded) bot.turn = 0;
    const edge = !groundAhead || wallAhead;
    const edgeOk = !edge || vproj > 2.5 || (bot.turn = (bot.turn || 0) + dt) > 0.35;
    let jump = p.grounded && !wait && !hold && ((edge && edgeOk) || hop || (gm && len < 4.4 && edge));
    if (plan && plan.jump && p.grounded && len < (typeof plan.jump === 'number' ? plan.jump : 2.2)) jump = true;
    bot.dbg2 = `${wait ? 'W' : '-'}${hold ? 'H' : '-'}${jump ? 'J' : '-'}${groundAhead ? 'g' : '-'}${wallAhead ? 'w' : '-'} tgt ${tx.toFixed(1)},${tz.toFixed(1)} i${bot.i}${plan ? 'P' : ''}`;
    if (jump) g.jumpEdge = true;
    if (plan && plan.stop !== undefined && !p.grounded && len < plan.stop + 0.4 && vproj > 1.2) { g.keys.delete('KeyW'); g.keys.add('KeyS'); }   // air brake for hops onto a head
    g.keys.add('Space');
    g._simulate(dt);
    w.hooks.frame?.(dt, g);
    bot.sim += dt;
    if (window.__trace && Math.floor(bot.sim * 4) !== Math.floor((bot.sim - dt) * 4)) window.__trace.push(`${bot.sim.toFixed(2)} s${w.botIndex?.()} ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)} ${p.grounded ? 'G' : 'a'} P ${c.partner.sx.toFixed(2)},${c.partner.sy.toFixed(2)},${c.partner.sz.toFixed(2)} ${bot.dbg2}`);
  };
  const run = () => { if (!window.__botOn) return; for (let k = 0; k < window.__speed && g.state === 'playing'; k++) window.__bot.step(1 / 60); };
  setInterval(run, 16);       // a timer, not rAF: the page that isn't in front gets no animation frames
};
for (const p of [A, B]) await p.evaluate(install);
if (process.env.TRACE_FROM) for (const p of [A, B]) await p.evaluate((a) => { window.__tr = a; }, [+process.env.TRACE_FROM, +process.env.TRACE_TO]);   // TRACE_FROM/TRACE_TO: bot sim-second window, logged into the 'deaths:' line
if (process.env.JUMP) {          // JUMP='{"at":[x,y,z],"p1":stepIndex,"p2":stepIndex}' – start from the middle of a level
  const J = JSON.parse(process.env.JUMP);
  for (const p of [A, B]) await p.evaluate((J) => {
    const g = window.__trust, w = g.world, me = g.coop.me;
    if (J.at) { const o = me === 'p1' ? -1 : 1; g.player.teleport(J.at[0] + o, J.at[1] + 0.01, J.at[2]); w.respawn = { x: J.at[0] + o, y: J.at[1] + 0.01, z: J.at[2], yaw: 0 }; }
    if (J.mark && window.__marks?.[J.mark]) w.botSetIndex?.(window.__marks[J.mark][me === 'p1' ? 0 : 1]);
    else if (J[me] !== undefined) w.botSetIndex?.(J[me]);
    return [me, J[me], w.botIndex?.()];
  }, J).then((r) => console.log('jump', r));
}
for (const p of [A, B]) await p.evaluate((tr) => { if (tr) window.__trace = []; window.__botOn = true; }, !!process.env.TRACE);

let last = 0, t0 = Date.now();
const snap = (p) => p.evaluate(() => { const g = window.__trust, b = window.__bot, pl = g.player; return { st: g.state, sim: +b.sim.toFixed(0), x: +pl.x.toFixed(1), y: +pl.y.toFixed(1), z: +pl.z.toFixed(1), d: g.deaths, wp: b.i, step: g.world.botIndex?.() }; });
let done = false;
while (!done) {
  await new Promise((r) => setTimeout(r, 2000));
  const [a, b] = await Promise.all([snap(A), snap(B)]);
  const sim = Math.max(a.sim, b.sim);
  if (errs.length && !globalThis.__shown) { globalThis.__shown = 1; console.log('PAGE ERROR:', errs[0]); }
  if (sim - last >= 20) { console.log(`sim ${sim}s · host ${JSON.stringify(a)} · guest ${JSON.stringify(b)}`); last = sim; }
  if ((a.st === 'complete' || a.st === 'ended') && (b.st === 'complete' || b.st === 'ended')) { console.log(`COMPLETED in ${sim}s sim (${Math.round((Date.now() - t0) / 1000)}s wall) · deaths host ${a.d} guest ${b.d}`); done = true; }
  else if (sim > maxSim) { console.log(`TIMEOUT host ${JSON.stringify(a)} · guest ${JSON.stringify(b)}`); done = true; process.exitCode = 1; }
}
if (process.env.TRACE) for (const [n, p] of [['host', A], ['guest', B]]) console.log(n, 'TRACE\n' + (await p.evaluate(() => window.__trace)).join('\n'));
if (process.env.PROBE) for (const [n, p] of [['host', A], ['guest', B]]) console.log(n, 'PROBE', JSON.stringify(await p.evaluate(process.env.PROBE)));   // e.g. PROBE='({f: window.__trust.focus && window.__trust.focus.label(window.__trust)})'
for (const [n, p] of [['host', A], ['guest', B]]) console.log(n, 'deaths:', (await p.evaluate(() => window.__bot.log)).join(' | ') || 'none');
const said = await Promise.all([A, B].map((p) => p.evaluate(() => window.__bot.said)));
console.log('narrator beats host:', [...new Set(said[0])].join(', '));
console.log('narrator beats guest:', [...new Set(said[1])].join(', '));
if (errs.length) console.log('PAGE ERRORS:\n' + errs.slice(0, 6).join('\n'));
await browser.close();
