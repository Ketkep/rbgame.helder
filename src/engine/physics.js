// Tiny AABB platformer physics. No dependencies on three/DOM so it can be tested headlessly.
// Units are metres / seconds. +Y is up. The player looks down -Z at yaw 0.

export const MOVE = {
  speed: 6.6,
  groundAccel: 95,
  groundFriction: 85,
  airAccel: 32,
  airDrag: 1.2,
  gravity: 26,
  jumpVel: 8.6,
  jumpCut: 2.4, // gravity multiplier while rising with jump released (short hops)
  maxFall: 46,
  coyote: 0.1,
  jumpBuffer: 0.12,
  halfW: 0.35,
  height: 1.8,
  eye: 1.62,
};

const EPS = 1e-3;

export class Body {
  // Centered axis-aligned box. `solid` bodies block the player; `enabled` toggles it entirely.
  constructor(x, y, z, hx, hy, hz) {
    this.x = x; this.y = y; this.z = z;
    this.hx = hx; this.hy = hy; this.hz = hz;
    this.dx = 0; this.dy = 0; this.dz = 0; // movement during the last substep (to carry riders)
    this.enabled = true;
    this.solid = true;
    this.slip = 0; // 0..1: how slippery the top face is (scales ground accel/friction)
    this.conv = null; // [vx, vz]: a conveyor belt – carries whatever stands on it
    this.tag = null;
  }
  get top() { return this.y + this.hy; }
  get bottom() { return this.y - this.hy; }
  setCenter(x, y, z) {
    this.dx = x - this.x; this.dy = y - this.y; this.dz = z - this.z;
    this.x = x; this.y = y; this.z = z;
  }
  clearDelta() { this.dx = this.dy = this.dz = 0; }
}

export class Mover {
  constructor() {
    this.x = 0; this.y = 0; this.z = 0; // feet centre
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.grounded = false;
    this.ground = null;
    this.coyoteT = 0;
    this.bufT = 0;
    this.jumpHeld = false;
    this.rising = false;
    this.justLanded = 0; // impact speed on the step we landed, else 0
    this.justJumped = false;
  }
  teleport(x, y, z) {
    this.x = x; this.y = y; this.z = z;
    this.vx = this.vy = this.vz = 0;
    this.grounded = false; this.ground = null; this.coyoteT = 0; this.bufT = 0;
    this.rising = false;
  }
}

function overlapsPlayer(p, b) {
  const hw = MOVE.halfW;
  return (
    p.x - hw < b.x + b.hx - EPS && p.x + hw > b.x - b.hx + EPS &&
    p.z - hw < b.z + b.hz - EPS && p.z + hw > b.z - b.hz + EPS &&
    p.y < b.y + b.hy - EPS && p.y + MOVE.height > b.y - b.hy + EPS
  );
}

function approach(v, target, maxDelta) {
  if (v < target) return Math.min(v + maxDelta, target);
  return Math.max(v - maxDelta, target);
}

/**
 * Advance one substep.
 * @param p        Mover
 * @param bodies   Body[]
 * @param input    { wx, wz (world-space wish dir, length<=1), jumpPressed (edge), jumpHeld }
 * @param dt       seconds (<= ~1/60 recommended)
 * @param opts     { jumpMul, coyoteExtra, accelX, accelZ (external accel such as wind), stepHeight }
 */
export function stepPlayer(p, bodies, input, dt, opts = {}) {
  const jumpMul = opts.jumpMul || 1;
  p.justLanded = 0;
  p.justJumped = false;

  // 1. Ride the thing we are standing on.
  if (p.grounded && p.ground && p.ground.enabled) {
    p.x += p.ground.dx; p.y += p.ground.dy; p.z += p.ground.dz;
    if (p.ground.conv) { p.x += p.ground.conv[0] * dt; p.z += p.ground.conv[1] * dt; }
  }

  // 2. Push out of anything that moved into us (movers, re-enabled platforms).
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b.enabled || !b.solid || !overlapsPlayer(p, b)) continue;
    const hw = MOVE.halfW;
    const pushXp = (b.x + b.hx) - (p.x - hw);
    const pushXn = (p.x + hw) - (b.x - b.hx);
    const pushZp = (b.z + b.hz) - (p.z - hw);
    const pushZn = (p.z + hw) - (b.z - b.hz);
    const pushYp = (b.y + b.hy) - p.y;
    const pushYn = (p.y + MOVE.height) - (b.y - b.hy);
    const m = Math.min(pushXp, pushXn, pushZp, pushZn, pushYp, pushYn);
    if (m === pushYp) { p.y += pushYp; if (p.vy < 0) p.vy = 0; }
    else if (m === pushYn) { p.y -= pushYn; if (p.vy > 0) p.vy = 0; }
    else if (m === pushXp) p.x += pushXp;
    else if (m === pushXn) p.x -= pushXn;
    else if (m === pushZp) p.z += pushZp;
    else p.z -= pushZn;
  }

  // 3. Timers.
  p.jumpHeld = !!input.jumpHeld;
  if (input.jumpPressed) p.bufT = MOVE.jumpBuffer;
  else p.bufT = Math.max(0, p.bufT - dt);
  if (p.grounded) p.coyoteT = MOVE.coyote + (opts.coyoteExtra || 0);
  else p.coyoteT = Math.max(0, p.coyoteT - dt);

  // 4. Horizontal velocity.
  const tx = input.wx * MOVE.speed;
  const tz = input.wz * MOVE.speed;
  const hasInput = input.wx !== 0 || input.wz !== 0;
  if (p.grounded) {
    const k = p.ground && p.ground.slip ? 1 - 0.9 * p.ground.slip : 1;
    const a = (hasInput ? MOVE.groundAccel : MOVE.groundFriction) * dt * k;
    p.vx = approach(p.vx, tx, a);
    p.vz = approach(p.vz, tz, a);
  } else {
    const a = (hasInput ? MOVE.airAccel : MOVE.airDrag) * dt;
    p.vx = approach(p.vx, tx, a);
    p.vz = approach(p.vz, tz, a);
  }
  const wk = p.grounded ? 4 : 1; // wind needs to beat ground friction to matter
  if (opts.accelX) p.vx += opts.accelX * dt * wk;
  if (opts.accelZ) p.vz += opts.accelZ * dt * wk;

  // 5. Jump.
  if (p.bufT > 0 && (p.grounded || p.coyoteT > 0)) {
    p.vy = MOVE.jumpVel * jumpMul;
    p.grounded = false; p.ground = null; p.coyoteT = 0; p.bufT = 0;
    p.rising = true; p.justJumped = true;
  }

  // 6. Gravity.
  let g = MOVE.gravity;
  if (p.vy > 0 && !p.jumpHeld) g *= MOVE.jumpCut;
  p.vy = Math.max(p.vy - g * dt, -MOVE.maxFall);
  if (p.vy <= 0) p.rising = false;

  // 7. Move + collide, one axis at a time.
  const wasGrounded = p.grounded;
  const impactV = p.vy;
  p.grounded = false; p.ground = null;
  const hw = MOVE.halfW;

  const stepH = wasGrounded && p.vy <= 0 ? (opts.stepHeight || 0) : 0;
  p.x += p.vx * dt;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b.enabled || !b.solid || !overlapsPlayer(p, b)) continue;
    if (stepH > 0 && tryStep(p, bodies, b, stepH)) continue;
    if (p.vx > 0) p.x = b.x - b.hx - hw; else p.x = b.x + b.hx + hw;
    p.vx = 0;
  }
  p.z += p.vz * dt;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b.enabled || !b.solid || !overlapsPlayer(p, b)) continue;
    if (stepH > 0 && tryStep(p, bodies, b, stepH)) continue;
    if (p.vz > 0) p.z = b.z - b.hz - hw; else p.z = b.z + b.hz + hw;
    p.vz = 0;
  }
  p.y += p.vy * dt;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b.enabled || !b.solid || !overlapsPlayer(p, b)) continue;
    if (p.vy > 0) { p.y = b.y - b.hy - MOVE.height; p.vy = 0; }
    else { p.y = b.y + b.hy; p.vy = 0; p.grounded = true; p.ground = b; }
  }

  // 8. Ground probe (stay glued to platforms that drop away / flat ground).
  if (!p.grounded && p.vy <= 0) {
    let best = null;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!b.enabled || !b.solid) continue;
      if (p.x - hw < b.x + b.hx - EPS && p.x + hw > b.x - b.hx + EPS &&
          p.z - hw < b.z + b.hz - EPS && p.z + hw > b.z - b.hz + EPS) {
        const gap = p.y - b.top;
        if (gap >= -0.02 && gap <= 0.03 && (!best || b.top > best.top)) best = b;
      }
    }
    if (best) { p.y = best.top; p.vy = 0; p.grounded = true; p.ground = best; }
  }

  if (p.grounded && !wasGrounded && impactV < -3) p.justLanded = -impactV;
}

/**
 * Auto step-up: if a grounded player walks into a low ledge (<= stepH above their feet) and there is
 * headroom, lift them onto it instead of blocking. Used for stairs/thresholds in interiors.
 */
function tryStep(p, bodies, b, stepH) {
  const lift = b.y + b.hy - p.y;
  if (lift <= 0 || lift > stepH) return false;
  const oy = p.y;
  p.y = b.y + b.hy;
  for (let i = 0; i < bodies.length; i++) {
    const o = bodies[i];
    if (o.enabled && o.solid && overlapsPlayer(p, o)) { p.y = oy; return false; }
  }
  return true;
}

/** AABB-vs-player overlap for hazards / triggers. `shrink` forgives grazes. */
export function playerTouches(p, b, shrink = 0) {
  const hw = MOVE.halfW - shrink;
  return (
    p.x - hw < b.x + b.hx && p.x + hw > b.x - b.hx &&
    p.z - hw < b.z + b.hz && p.z + hw > b.z - b.hz &&
    p.y + shrink < b.y + b.hy && p.y + MOVE.height - shrink > b.y - b.hy
  );
}

/**
 * Highest solid surface directly beneath (x,z) at or below y. Used for the blob shadow.
 */
export function groundBelow(bodies, x, z, y, r = 0.05) {
  let best = -Infinity;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b.enabled || !b.solid) continue;
    if (x + r < b.x - b.hx || x - r > b.x + b.hx || z + r < b.z - b.hz || z - r > b.z + b.hz) continue;
    const t = b.top;
    if (t <= y + 0.05 && t > best) best = t;
  }
  return best;
}

/** Distance along a ray to a Body's box (slab method), or Infinity. Direction need not be normalised. */
export function rayAABB(ox, oy, oz, dx, dy, dz, b, pad = 0) {
  let t0 = 0, t1 = Infinity;
  const mins = [b.x - b.hx - pad, b.y - b.hy - pad, b.z - b.hz - pad];
  const maxs = [b.x + b.hx + pad, b.y + b.hy + pad, b.z + b.hz + pad];
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < mins[i] || o[i] > maxs[i]) return Infinity; continue; }
    let a = (mins[i] - o[i]) / d[i], c = (maxs[i] - o[i]) / d[i];
    if (a > c) { const t = a; a = c; c = t; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

// ---- analytic helpers for level design / validation -------------------------------------

export function jumpApex() { return (MOVE.jumpVel * MOVE.jumpVel) / (2 * MOVE.gravity); }

/**
 * Max horizontal distance (feet travel) of a full-speed running jump that lands `dh` metres
 * above (dh>0) or below (dh<0) the take-off surface. Returns 0 if unreachable.
 */
export function reach(dh) {
  const v = MOVE.jumpVel, g = MOVE.gravity;
  const disc = v * v - 2 * g * dh;
  if (disc < 0) return 0;
  const t = (v + Math.sqrt(disc)) / g;
  return t * MOVE.speed;
}
