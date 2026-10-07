// "Is that thing on screen right now?" — used by weeping-angel style levels (furniture that moves when you look away).
// Works from the player's yaw/pitch and the camera's fov/aspect, so it does not depend on the render loop having run.
import * as THREE from 'three';

const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function inView(game, x, y, z, margin = 0.15) {
  const p = game.player;
  const dx = x - p.x, dy = y - (p.y + 1.62), dz = z - p.z;
  const dist = Math.hypot(dx, dz) || 1e-6;
  const dyaw = wrap(Math.atan2(-dx, -dz) - game.yaw);
  const dpitch = Math.atan2(dy, dist) - game.pitch;
  const vh = THREE.MathUtils.degToRad(game.camera.fov) / 2;
  const hh = Math.atan(Math.tan(vh) * (game.camera.aspect || 1.7));
  return Math.abs(dyaw) < hh + margin && Math.abs(dpitch) < vh + margin;
}
