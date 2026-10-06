import { Body, Mover, stepPlayer, MOVE, reach, jumpApex, rayAABB } from '../src/engine/physics.js';

const DT = 1 / 120;
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

function sim(bodies, p, frames, inputFn) {
  for (let i = 0; i < frames; i++) {
    const inp = inputFn(i, p);
    stepPlayer(p, bodies, inp, DT);
    for (const b of bodies) b.clearDelta();
  }
}
const run = { wx: 0, wz: -1, jumpPressed: false, jumpHeld: false };

// 1. Falls and lands on a floor
{
  const floor = new Body(0, -0.5, 0, 10, 0.5, 10);
  const p = new Mover(); p.teleport(0, 3, 0);
  sim([floor], p, 240, () => ({ wx: 0, wz: 0 }));
  ok(p.grounded && Math.abs(p.y) < 1e-6, `lands on floor (y=${p.y.toFixed(4)})`);
}

// 2. Max running jump distance (jump at the last moment, hold jump); measure feet travel until back at take-off height
{
  const A = new Body(0, -0.5, -5, 3, 0.5, 5);          // top at y=0, z in [-10,0]
  const p = new Mover(); p.teleport(0, 0, -5);
  let jumped = false, startZ = 0, landZ = null;
  for (let i = 0; i < 2000 && landZ === null; i++) {
    const inp = { wx: 0, wz: -1, jumpPressed: false, jumpHeld: true };
    if (!jumped && p.grounded && p.z <= -10 - MOVE.halfW + 0.05) { inp.jumpPressed = true; jumped = true; startZ = p.z; }
    stepPlayer(p, [A], inp, DT);
    if (jumped && !p.grounded && p.vy < 0 && p.y <= 0) landZ = p.z;
  }
  const travel = startZ - landZ;
  console.log(`   feet travel = ${travel.toFixed(2)} m, analytic reach(0) = ${reach(0).toFixed(2)} m, apex = ${jumpApex().toFixed(2)} m`);
  console.log(`   max clearable gap (edge to edge) ~ ${(travel + 2 * MOVE.halfW).toFixed(2)} m (AABB forgiveness included)`);
  ok(travel > 4.0 && travel < 4.8, 'running jump travel ~4.3m');
}

// 3. Short hop is shorter than full jump
{
  const floor = new Body(0, -0.5, 0, 30, 0.5, 30);
  function hop(hold) {
    const p = new Mover(); p.teleport(0, 0, 0);
    let top = 0;
    for (let i = 0; i < 400; i++) {
      stepPlayer(p, [floor], { wx: 0, wz: 0, jumpPressed: i === 2, jumpHeld: hold && i < 100 || (!hold && i < 6) }, DT);
      top = Math.max(top, p.y);
    }
    return top;
  }
  const full = hop(true), short = hop(false);
  console.log(`   full jump apex ${full.toFixed(2)} m, tap hop apex ${short.toFixed(2)} m`);
  ok(full > 1.3 && short < full * 0.7, 'variable jump height works');
}

// 4. Climbs a +1.2m step by jumping, can't climb +1.6m
{
  function climb(h) {
    const A = new Body(0, -0.5, 0, 5, 0.5, 5);
    const B = new Body(0, h - 0.5, -9, 5, 0.5, 3);   // z in [-12,-6], top at h
    const p = new Mover(); p.teleport(0, 0, 0);
    let jumped = false;
    for (let i = 0; i < 220; i++) {
      const inp = { wx: 0, wz: -1, jumpPressed: false, jumpHeld: true };
      if (!jumped && p.grounded && p.z < -3.4) { inp.jumpPressed = true; jumped = true; }
      stepPlayer(p, [A, B], inp, DT);
    }
    return p.y >= h - 0.01 && p.grounded && Math.abs(p.z + 9) < 3.5;
  }
  ok(climb(1.2), 'can jump onto +1.2m ledge');
  ok(!climb(1.6), 'cannot jump onto +1.6m ledge');
}

// 5. Moving platform carries rider
{
  const floor = new Body(0, -0.5, 0, 2, 0.5, 2);
  const p = new Mover(); p.teleport(0, 0, 0);
  let t = 0;
  for (let i = 0; i < 600; i++) {
    t += DT;
    floor.setCenter(Math.sin(t) * 6, -0.5, 0); // moves in X
    stepPlayer(p, [floor], { wx: 0, wz: 0 }, DT);
  }
  ok(Math.abs(p.x - floor.x) < 0.5 && p.grounded, `rider carried (p.x=${p.x.toFixed(2)}, plat.x=${floor.x.toFixed(2)})`);
}

// 6. Walls stop you, no tunnelling at terminal velocity through 0.5m floor
{
  const floor = new Body(0, -0.25, 0, 20, 0.25, 20);
  const p = new Mover(); p.teleport(0, 120, 0);
  for (let i = 0; i < 2000; i++) stepPlayer(p, [floor], { wx: 0, wz: 0 }, 1 / 60);
  ok(p.grounded && Math.abs(p.y) < 1e-6, 'no tunnelling at terminal velocity (dt=1/60, 0.5m floor)');
}

// 7. Auto step-up (stairs) only when enabled and only up to the step height
{
  function walkInto(stepH, riser) {
    const floor = new Body(0, -0.5, 0, 20, 0.5, 20);
    const step = new Body(0, riser / 2, -6, 3, riser / 2, 2);   // top at `riser`, z in [-8,-4]
    const p = new Mover(); p.teleport(0, 0, 0);
    for (let i = 0; i < 110; i++) stepPlayer(p, [floor, step], { wx: 0, wz: -1 }, DT, { stepHeight: stepH });  // ~6m: standing on the step
    return p;
  }
  const a = walkInto(0.5, 0.35), b = walkInto(0.5, 0.7), c = walkInto(0, 0.35);
  ok(a.grounded && Math.abs(a.y - 0.35) < 1e-3 && a.z < -4.5, `steps up a 0.35m riser when stepHeight=0.5 (y=${a.y.toFixed(2)}, z=${a.z.toFixed(1)})`);
  ok(b.y < 0.01 && b.z > -4, `does NOT step a 0.7m riser (y=${b.y.toFixed(2)}, z=${b.z.toFixed(1)})`);
  ok(c.y < 0.01 && c.z > -4, 'no step-up when stepHeight is 0 (campaign 1 behaviour unchanged)');
  // low ceiling blocks the step
  const floor = new Body(0, -0.5, 0, 20, 0.5, 20), step = new Body(0, 0.175, -6, 3, 0.175, 2), ceil = new Body(0, 2.0, -6, 3, 0.5, 2);
  const p = new Mover(); p.teleport(0, 0, 0);
  for (let i = 0; i < 110; i++) stepPlayer(p, [floor, step, ceil], { wx: 0, wz: -1 }, DT, { stepHeight: 0.5 });
  ok(p.y < 0.01 && p.z > -4, 'no step-up without headroom');
}

// 8. Ray vs box (used for interaction targeting)
{
  const b = new Body(0, 1, -5, 1, 1, 1);
  ok(Math.abs(rayAABB(0, 1, 0, 0, 0, -1, b) - 4) < 1e-6, 'ray hits box front face at distance 4');
  ok(rayAABB(0, 1, 0, 0, 0, 1, b) === Infinity, 'ray pointing away misses');
  ok(rayAABB(5, 1, 0, 0, 0, -1, b) === Infinity, 'ray beside the box misses');
  ok(rayAABB(0, 3, 0, 0, -0.4, -1, b) < Infinity, 'downward ray hits the top of the box');
}

// reach table for level design
for (const dh of [-3, -2, -1, 0, 0.5, 0.8, 1.0, 1.2, 1.35]) console.log(`   reach(dh=${dh}) = ${reach(dh).toFixed(2)} m`);

console.log(fails ? `\n${fails} FAILED` : '\nall physics tests passed');
process.exit(fails ? 1 : 0);
