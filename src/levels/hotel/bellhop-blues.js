import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, roomShell, hotelHalo, GOLD } from './kit.js';

// Hotel level 5 — "Bellhop Blues" (Easy · Mezzanine). A chase through the back-of-house service corridor: a very large,
// very keen brass service bell rolls after you. It is slower than you. It is also patient. Conveyor belts, wet marble,
// stairs and a runaway trolley stand between you and the service elevator.

const H = 9;
const BELL_W = 7.2, BELL_H = 3.8, BELL_D = 3.4;

export default {
  id: 'hotel-5',
  name: 'Bellhop Blues',
  music: 'hotel2',
  completeQuip: 'The bell is still outside. It is not angry. It is patient. There is a difference. It is worse.',

  build(w, game) {
    hotelEnv(w);
    w.setTheme({ tex: 'tile', color: 0xffffff, trim: null, edge: null, edgeOpacity: 0, roughness: 0.55, metalness: 0, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.spawn = { x: 0, y: 0, z: 11, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -8;
    const zEnd = -106;
    roomShell(w, { x0: -7.5, x1: 7.5, z0: zEnd, z1: 16, yb: -10, H, wallTex: 'tile', wallColor: 0xcfe0d6, pilasterEvery: 14, lamps: false });
    w.plat({ x: 0, y: -9.5, z: (zEnd + 16) / 2, w: 15, d: 16 - zEnd, h: 1, tex: 'tile', color: 0x2c3a36, roughness: 0.9 });

    // ---- the course ------------------------------------------------------------------------------------
    const path = (p) => { p.o.path = true; return p; };
    const seg = (z0, z1, { y = 0, ww = 8, tex = 'tile', color = 0xe9eee9, h = 1.4, slippery = 0, x = 0, rough = 0.5 } = {}) =>
      path(w.plat({ x, y, z: (z0 + z1) / 2, w: ww, d: Math.abs(z1 - z0), h, tex, color, roughness: rough, radius: 0.05, slippery }));
    const stripe = (z0, z1, ww = 7.6, y = 0) => { for (const z of [z0, z1]) w.box({ x: 0, y: y + 0.01, z, w: ww, h: 0.03, d: 0.16, color: 0xffd21f, shadow: false }); };

    const S0 = seg(13, 0, { tex: 'carpet', color: 0xffffff, rough: 0.9 });
    const S1 = seg(0, -14);
    const S2 = seg(-16.8, -24);
    const belt = path(w.plat({ x: 0, y: 0, z: -31, w: 8, d: 8, h: 1.0, tex: 'metal', color: 0x4a5160, roughness: 0.5, metalness: 0.5, radius: 0.03 }));
    w.conveyor(belt, { vz: 3.0 });
    for (const sx of [-1, 1]) w.box({ x: sx * 4.1, y: 0.12, z: -31, w: 0.24, h: 0.5, d: 8, color: GOLD, metal: 1, rough: 0.35, shadow: false });
    const S3 = seg(-35, -40);
    w.checkpoint({ x: 0, y: 0, z: -37.5, real: true });
    const M1 = seg(-42.4, -48, { ww: 4.8, x: -1.8, tex: 'marble', color: 0xd0d0dc, rough: 0.14, slippery: 0.88 });
    const M2 = seg(-48, -53.6, { ww: 4.8, x: 1.8, tex: 'marble', color: 0xd0d0dc, rough: 0.14, slippery: 0.88 });
    const stairs = [];
    for (let k = 0; k < 6; k++) stairs.push(seg(-56.4 - k * 1.7, -56.4 - (k + 1) * 1.7, { y: 0.4 * (k + 1), ww: 6, h: 0.4 * (k + 1) + 1.0, tex: 'stone', color: 0xe4d8c0 }));
    const Y2 = 2.4;
    const S5 = seg(-66.6, -73, { y: Y2 });
    w.checkpoint({ x: 0, y: Y2, z: -69.8, real: true });
    // the trolley: it has wheels. It uses them.
    const TZ = -77;
    const trolley = path(w.plat({ x: 0, y: Y2, z: TZ, w: 3.2, d: 3.0, h: 0.1, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.03 }));
    // it hangs from a ceiling rail (a luggage gondola) so it is not rolling on thin air
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) trolley.attach(w.box({ x: sx * 1.45, y: (Y2 + H - 0.7) / 2, z: TZ + sz * 1.3, w: 0.08, h: H - 0.7 - Y2, d: 0.08, color: GOLD, metal: 1, rough: 0.28, static: false }));
    trolley.attach(w.box({ x: 0, y: H - 0.55, z: TZ, w: 3.4, h: 0.4, d: 1.6, color: 0x3a3f4a, metal: 0.8, rough: 0.35, static: false }));
    trolley.attach(w.box({ x: 0, y: Y2 + 0.45, z: TZ - 1.45, w: 3.2, h: 0.9, d: 0.06, color: GOLD, metal: 1, rough: 0.3, static: false }));   // a little rail on the far edge
    w.box({ x: 0, y: H - 0.25, z: TZ, w: 15, h: 0.4, d: 0.5, color: 0x4a5160, metal: 0.8, rough: 0.4, shadow: false });
    w.rollaway(trolley, { dir: [1, 0], dist: 5, accel: 3.5, speed: 5.5, delay: 0.8, hold: 2.6, back: 2.0, onGo: () => game.say('hotel.l5.trolley', { priority: 1 }) });
    const S6 = seg(-81.5, -102, { y: Y2 });
    stripe(-81.7, -101.8, 7.6, Y2);
    stripe(0.2, -13.8); stripe(-17, -23.8); stripe(-35.2, -39.8); stripe(-66.8, -72.8, 7.6, Y2);
    void S0; void S1; void S2; void S3; void M1; void M2; void S5; void S6;

    // the service elevator at the end
    for (const sx of [-1, 1]) w.plat({ x: sx * 1.45, y: Y2 + 4, z: -103.6, w: 2.9, d: 0.5, h: 4, tex: 'metal', color: 0xbfc6d2, roughness: 0.35, metalness: 0.8 });
    w.box({ x: 0, y: Y2 + 4.5, z: -103.3, w: 7, h: 0.6, d: 0.4, color: GOLD, metal: 1, rough: 0.35 });
    w.sign({ text: 'SERVICE ELEVATOR', x: 0, y: Y2 + 5.4, z: -103.2, w: 6, h: 0.9, color: '#ffd21f', double: false, tw: 1024, size: 70 });
    w.goal({ x: 0, y: Y2, z: -99, color: GOLD, onReach: () => { game.say('hotel.l5.done', { priority: 2 }); game.completeLevel(); } });

    // ---- lights: red emergency strips that pulse when the bell is near --------------------------------------
    const alarmMat = glowMaterial(0xff2a3a, 1.0);
    for (let z = 12; z > zEnd + 4; z -= 8) for (const sx of [-1, 1]) w.box({ x: sx * 7.0, y: H - 1.0, z, w: 0.14, h: 0.14, d: 3.0, color: 0xffffff, shadow: false }).material = alarmMat;
    for (let z = 10; z > zEnd + 4; z -= 12) { w.box({ x: 0, y: H - 0.35, z, w: 3.0, h: 0.1, d: 0.3, glow: 0xdff4ff, glowIntensity: 1.3, shadow: false }); hotelHalo(w, 0, H - 0.9, z, 5.5, 0xcfe8ff, 0.12); }
    w.light(0xfff0d0, 14, 28, 0, 6.5, -6); w.light(0xfff0d0, 14, 28, 0, 6.5, -42); w.light(0xfff0d0, 14, 28, 0, 8.5, -78);
    w.sign({ text: 'STAFF ONLY · BACK OF HOUSE', x: 0, y: 5.4, z: 15.4, w: 7, h: 0.8, color: '#ffd21f', double: false, tw: 1024, size: 54, rotY: Math.PI });

    // ---- the bell ----------------------------------------------------------------------------------------------
    let startZ = 25, tStart = 0, delay = 2.4;
    const V0 = 4.8, VMAX = 5.9, ACC = 0.14;
    const dist = (tau) => { const tc = (VMAX - V0) / ACC; return tau <= tc ? V0 * tau + 0.5 * ACC * tau * tau : V0 * tc + 0.5 * ACC * tc * tc + VMAX * (tau - tc); };
    const bellZ = (t) => { const tau = Math.max(0, t - tStart - delay); return startZ - dist(tau) * (game.baby ? 0.85 : 1); };
    const hz = w.hazard({ x: 0, y: BELL_H / 2, z: 25, w: BELL_W, h: BELL_H, d: BELL_D, color: 0xff3a46, move: (t) => ({ z: bellZ(t) - 25 }) });
    hz.core.visible = false; hz.shell.visible = false;
    const bell = bellVisual(hz.group, BELL_H);
    w.onRespawn(() => { startZ = w.respawn.z + 15; tStart = w.t; delay = 1.8; });
    let dingT = 0, near = false, started = false, bellOffset = 0;
    w.onUpdate((dt, t) => {
      const z = bellZ(t), pz = game.player.z, gap = pz - z;   // >0: bell is behind you
      bell.rotation.z = Math.sin(t * 9) * 0.045;
      bell.position.y = Math.abs(Math.sin(t * 5.5)) * 0.22;
      bellOffset = gap;
      const moving = t - tStart > delay;
      // alarm lights flare as it closes in
      const k = moving ? Math.max(0, Math.min(1, 1 - (gap - 4) / 34)) : 0;
      alarmMat.color.setRGB(1.0, 0.16, 0.22).multiplyScalar(0.5 + k * 3.2 * (0.55 + 0.45 * Math.sin(t * (4 + k * 10))));
      // ding ding ding
      if (moving && game.state === 'playing') {
        dingT -= dt;
        if (dingT <= 0 && gap < 36) { game.audio.bell(); dingT = gap < 9 ? 0.22 : gap < 18 ? 0.4 : 0.75; }
      }
    });
    void bellOffset;

    // ---- the host -----------------------------------------------------------------------------------------------
    let t0 = 0, intro = false, seg1 = false, seg2 = false, seg3 = false, seg4 = false;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      const p = g.player;
      if (!intro && t0 > 1.0) { intro = true; g.say('hotel.l5.intro'); }
      if (!started && w.t - tStart > delay) { started = true; g.say('hotel.l5.go', { priority: 2 }); }
      if (!near && w.t - tStart > delay && p.z - bellZ(w.t) < 9) { near = true; g.say('hotel.l5.close', { priority: 1 }); }
      if (!seg1 && p.z < -27 && p.z > -34) { seg1 = true; g.say('hotel.l5.belts', { priority: 1 }); }
      if (!seg2 && p.z < -43 && p.z > -50) { seg2 = true; g.say('hotel.l5.marble', { priority: 1 }); }
      if (!seg3 && p.z < -57 && p.z > -62) { seg3 = true; g.say('hotel.l5.stairs', { priority: 1 }); }
      if (!seg4 && p.z < -86) { seg4 = true; g.say('hotel.l5.last', { priority: 1 }); }
    };
    w.hooks.onCheckpoint = () => { game.say('hotel.l5.cp', { priority: 1 }); near = false; };
    w.hooks.onDeath = (info) => {
      if (info.reason === 'hazard') { game.say('hotel.l5.caught', { priority: 2 }); return true; }
      return false;
    };
    w.chase = { hz, bellZ, get startZ() { return startZ; }, get tStart() { return tStart; }, get delay() { return delay; } };
  },
};

// the bellhop: a gigantic brass service bell with a plunger on top and a very bad attitude
function bellVisual(group, bh) {
  const brass = new THREE.MeshStandardMaterial({ color: 0xe0b04a, metalness: 1, roughness: 0.22, emissive: 0x3a2200, emissiveIntensity: 0.5 });
  const root = new THREE.Group(); root.position.y = -bh / 2; group.add(root);
  const pts = [[3.55, 0.0], [3.5, 0.18], [3.3, 0.8], [2.8, 1.7], [2.0, 2.5], [1.1, 3.0], [0.45, 3.2], [0.0, 3.25]].map(([x, y]) => new THREE.Vector2(x, y));
  const dome = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), brass); dome.castShadow = true; root.add(dome);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.52, 0.17, 10, 48), brass); ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; root.add(ring);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.35, 12), brass); stem.position.y = 3.35; root.add(stem);
  const btn = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), brass); btn.position.y = 3.65; root.add(btn);
  // face on the north side (-z): angry eyes
  const white = plainMaterial(0xffffff, { roughness: 0.3 }), black = plainMaterial(0x0a0a0a, { roughness: 0.4 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), white); eye.position.set(sx * 1.05, 2.0, -2.35); eye.scale.set(1, 1.15, 0.6); root.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), black); pupil.position.set(sx * 1.05 - sx * 0.05, 1.95, -2.6); root.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.18), black); brow.position.set(sx * 1.05, 2.78, -2.2); brow.rotation.z = sx * 0.4; root.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.15), black); mouth.position.set(0, 1.0, -3.0); root.add(mouth);
  return root;
}
