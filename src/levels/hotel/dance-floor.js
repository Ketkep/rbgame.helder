import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture } from '../../engine/materials.js';
import { hotelEnv, roomShell, hotelHalo, GOLD } from './kit.js';

// Hotel level 10 — "Dance Floor" (Medium · Ballroom). The disco. The tiles blink on the beat: step on one, hop to the next
// while it is lit. Rest on the solid VIP booths. Every so often the DJ yells FREEZE and everybody has to stand perfectly still.

const BPM = 128, BEAT = 60 / BPM;
const P = 2.8;                 // blink period (s) of a tile
const ON = 1.8;                // lit for this long
const STEP = 0.8;              // phase shift between consecutive tiles (about the time it takes to run one hop)
const FREEZE_EVERY = 15, FREEZE_WARN = 1.6, FREEZE_LEN = 1.9;
const NEON = [0xff3fa4, 0x3fd0ff, 0xffd23f, 0x7dff6a, 0xb06cff];

export default {
  id: 'hotel-10',
  name: 'Dance Floor',
  music: 'hotel',
  completeQuip: 'You danced. Technically. A judge would call it "falling with rhythm".',

  build(w, game) {
    w.env({
      top: 0x07041a, horizon: 0x2a1450, bottom: 0x06040c,
      fog: { color: 0x120a28, near: 40, far: 170 },
      sun: { color: 0x9db4ff, intensity: 0.2, dir: [0.2, 0.9, 0.3], shadow: false },
      hemi: { sky: 0x9a8cff, ground: 0x3a2050, intensity: 0.6 },
      exposure: 0.95, stars: 0.4,
      bloom: { strength: 0.7, radius: 0.8, threshold: 0.8 },
      motes: { color: 0xffa0ff, count: 220, size: 0.1, opacity: 0.6 },
      envMap: { top: 0xb0a0ff, mid: 0x4a2a6a, bottom: 0x120a1a, intensity: 0.5, lights: [{ pos: [0, 10, 0], w: 14, h: 14, color: 0xff80ff, intensity: 2.0 }, { pos: [-14, 3, 0], w: 6, h: 8, color: 0x60d0ff, intensity: 1.8 }] },
    });
    w.setTheme({ tex: 'grid', color: 0xffffff, trim: null, edge: null, edgeOpacity: 0, roughness: 0.3, metalness: 0.2, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.spawn = { x: 0, y: 0, z: 10, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -8;
    const PER = 6, SECTIONS = 3;
    const zEnd = 5.35 - SECTIONS * (PER * 5.0 + 6.9) - 24;   // the course is that long, plus the DJ booth
    roomShell(w, { x0: -17, x1: 17, z0: zEnd, z1: 17, yb: -10, H: 16, wallTex: 'curtain', wallColor: 0x8a5ac8, pilasterEvery: 14, lamps: false });
    w.plat({ x: 0, y: -9.5, z: (zEnd + 17) / 2, w: 34, d: 17 - zEnd, h: 1, tex: 'grid', color: 0x2a1a44, roughness: 0.6 });

    // ---- start + the course -----------------------------------------------------------------------------------------------
    const path = (p) => { p.o.path = true; return p; };
    path(w.plat({ x: 0, y: 0, z: 9, w: 12, d: 10, h: 1.4, tex: 'stage', color: 0x4a2a7a, roughness: 0.3, radius: 0.05, trim: 0xff3fa4 }));
    const tiles = [];
    const booths = [];
    let z = 5.35, x = 0, idx = 0;
    const seq = [];
    for (let sct = 0; sct < SECTIONS; sct++) {
      for (let k = 0; k < PER; k++) seq.push({ kind: 'tile', sct });
      seq.push({ kind: 'booth', sct });
    }
    let side = 1;
    seq.forEach((e, n) => {
      if (e.kind === 'booth') {
        z -= 5.95;
        const b = path(w.plat({ x: 0, y: 0, z, w: 9, d: 5.2, h: 1.4, tex: 'stage', color: 0x3a2a6a, roughness: 0.25, radius: 0.05, trim: 0xffd23f }));
        booths.push({ pl: b, z, sct: e.sct });
        w.checkpoint({ x: 0, y: 0, z, real: true });
        z -= 0.95;
        side = 1; x = 0;
        return;
      }
      z -= 5.0;
      x = Math.max(-5, Math.min(5, x + side * (1.8 + Math.random() * 2.2))); side = Math.random() < 0.7 ? -side : side;
      const col = NEON[idx % NEON.length];
      const size = 2.7 - e.sct * 0.1;
      const pl = path(w.plat({ x, y: 0, z, w: size, d: size, h: 0.5, tex: 'grid', color: col, roughness: 0.25, radius: 0.08 }));
      // overlay glow + a permanent ghost outline so you can see where it will be
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(size - 0.2, size - 0.2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0.26, 0); pl.group.add(glow);
      const ghost = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      ghost.rotation.x = -Math.PI / 2; ghost.position.set(x, 0.02, z); w.add(ghost);
      pl.o.moving = true; pl.group.matrixAutoUpdate = true;
      tiles.push({ pl, glow, ghost, col, phase: -n * STEP, idx: idx++, x, z, state: 'on', held: false });
    });
    const lastZ = z;
    // the DJ booth and the goal
    const dj = path(w.plat({ x: 0, y: 0, z: lastZ - 7, w: 14, d: 8, h: 1.4, tex: 'stage', color: 0x2a1a5a, roughness: 0.25, radius: 0.05, trim: 0xff3fa4 }));
    void dj;
    w.box({ x: 0, y: 1.3, z: lastZ - 9.5, w: 6, h: 1.2, d: 1.4, color: 0x14101e, metal: 0.4, rough: 0.4 });
    w.box({ x: -1.4, y: 1.95, z: lastZ - 9.5, w: 1.4, h: 0.1, d: 1.0, glow: 0x3fd0ff, glowIntensity: 1.6, shadow: false });
    w.box({ x: 1.4, y: 1.95, z: lastZ - 9.5, w: 1.4, h: 0.1, d: 1.0, glow: 0xff3fa4, glowIntensity: 1.6, shadow: false });
    w.sign({ text: 'DJ HOST', x: 0, y: 5.4, z: lastZ - 11.2, w: 6, h: 1.4, color: '#ffd23f', double: false, tw: 1024, size: 130, glow: true });
    w.goal({ x: 0, y: 0, z: lastZ - 5, color: GOLD, onReach: () => { game.say('hotel.l10.done', { priority: 2 }); game.completeLevel(); } });
    w.sign({ text: 'DANCE FLOOR · NO STANDING', x: 0, y: 6.0, z: 16.4, w: 9, h: 1.0, color: '#ff3fa4', double: false, tw: 1024, size: 66, rotY: Math.PI, glow: true });

    // ---- the disco -------------------------------------------------------------------------------------------------------------
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 2), new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 1, roughness: 0.05, flatShading: true, emissive: 0x222244 }));
    ball.position.set(0, 12.5, -20); w.add(ball);
    const beams = [];
    for (let k = 0; k < 8; k++) {
      const col = NEON[k % NEON.length];
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.8, 18, 16, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const pivot = new THREE.Group(); pivot.position.set((k % 2 ? 1 : -1) * 15, 15.5, 6 - k * 14); cone.position.y = -9; pivot.add(cone); w.add(pivot);
      beams.push({ pivot, ph: k * 1.3 });
    }
    for (const [sx, zz] of [[-1, 6], [1, 6], [-1, -40], [1, -40], [-1, -85], [1, -85]]) {
      w.box({ x: sx * 15.6, y: 2.2, z: zz, w: 1.6, h: 4.4, d: 2.4, color: 0x14101e, metal: 0.3, rough: 0.6, shadow: false });
      for (const yy of [1.2, 3.2]) { const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.12, 20), plainMaterial(0x222233, { roughness: 0.4 })); cone.rotation.z = Math.PI / 2; cone.position.set(sx * 14.7, yy, zz); w.add(cone); }
    }
    w.light(0xff60c0, 20, 40, -8, 8, -6); w.light(0x60c0ff, 20, 40, 8, 8, -46); w.light(0xffd060, 20, 40, -8, 8, -86);
    const neonMats = NEON.map((c) => glowMaterial(c, 1.3));
    for (let zz = 14; zz > zEnd + 4; zz -= 6) for (const sx of [-1, 1]) { const strip = w.box({ x: sx * 16.7, y: 8, z: zz, w: 0.12, h: 6, d: 0.12, color: 0xffffff, shadow: false }); strip.material = neonMats[Math.abs(Math.round(zz / 6)) % NEON.length]; }

    // ---- tile logic -------------------------------------------------------------------------------------------------------------
    const mod = (a, b) => ((a % b) + b) % b;
    const isOn = (tile, t) => mod(t + tile.phase, P) < ON;
    const warnOff = (tile, t) => { const u = mod(t + tile.phase, P); return u > ON - 0.45 && u < ON; };
    const warnOn = (tile, t) => { const u = mod(t + tile.phase, P); return u > P - 0.4; };
    let frozen = false, freezeStart = -999, warned = false, lastBeat = -1;
    const freezeAt = (t) => { const k = Math.floor(t / FREEZE_EVERY); return t - k * FREEZE_EVERY; };   // seconds into this 15 s cycle
    const phaseOf = (t) => {   // 'play' | 'warn' | 'freeze'
      if (t < 8) return 'play';
      const u = freezeAt(t);
      if (u >= FREEZE_EVERY - FREEZE_WARN - FREEZE_LEN && u < FREEZE_EVERY - FREEZE_LEN) return 'warn';
      if (u >= FREEZE_EVERY - FREEZE_LEN) return 'freeze';
      return 'play';
    };
    // tiles that are lit when the freeze begins stay lit, those that are dark stay dark
    const heldState = new Map();
    w.onUpdate((dt, t) => {
      const ph = phaseOf(t);
      const beat = Math.floor(t / BEAT), pulse = 0.5 + 0.5 * Math.cos(((t / BEAT) % 1) * Math.PI * 2);
      if (beat !== lastBeat) { lastBeat = beat; if (game.state === 'playing') { if (beat % 2 === 0) game.audio.kick(); else game.audio.hat(); } }
      ball.rotation.y += dt * 0.7;
      for (const b of beams) { b.pivot.rotation.z = Math.sin(t * 0.9 + b.ph) * 0.6; b.pivot.rotation.x = Math.cos(t * 0.7 + b.ph) * 0.4; }
      if (ph === 'freeze' && !frozen) { frozen = true; freezeStart = t; for (const tl of tiles) heldState.set(tl, tl.state === 'on' || tl.state === 'warnoff'); }
      if (ph !== 'freeze' && frozen) frozen = false;
      if (ph === 'warn' && !warned) { warned = true; game.ui.stamp('FREEZE!'); game.say('hotel.l10.warn', { priority: 2 }); }
      if (ph === 'play') warned = false;
      for (const tl of tiles) {
        let on, st;
        if (frozen) { on = heldState.get(tl) ?? true; st = on ? 'on' : 'off'; }
        else {
          on = isOn(tl, t);
          st = on ? (warnOff(tl, t) ? 'warnoff' : 'on') : (warnOn(tl, t) ? 'warnon' : 'off');
        }
        tl.state = st;
        const solid = on;
        if (tl.pl.body.enabled !== solid) { tl.pl.body.enabled = solid; tl.pl.group.visible = solid; }
        if (solid) tl.glow.material.opacity = (st === 'warnoff' ? (Math.floor(t * 12) % 2 ? 0.8 : 0.0) : 0.15 + pulse * 0.35);
        tl.ghost.material.opacity = solid ? 0.05 : st === 'warnon' ? 0.55 + 0.3 * Math.sin(t * 30) : 0.16;
        if (frozen) { tl.glow.material.color.setHex(0xff3040); tl.ghost.material.color.setHex(0xff3040); } else { tl.glow.material.color.setHex(tl.col); tl.ghost.material.color.setHex(tl.col); }
      }
      // FREEZE: any movement is fatal
      if (frozen && game.state === 'playing' && t - freezeStart > 0.3) {
        const p = game.player;
        if (p.grounded && Math.hypot(p.vx, p.vz) > 1.3) { game.say('hotel.l10.moved', { priority: 2 }); game.kill('moved'); }
      }
    });
    w.onRespawn(() => { /* the cycle keeps going; you get a moment of safety because the first freeze is later */ });

    // ---- the host ---------------------------------------------------------------------------------------------------------------------
    let t0 = 0, intro = false, sec2 = false, sec3 = false, sec4 = false, firstFreeze = false;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      const p = g.player;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l10.intro'); g.say('hotel.l10.intro2'); }
      if (!firstFreeze && frozen) { firstFreeze = true; g.say('hotel.l10.freeze', { priority: 1 }); }
      if (!sec2 && p.z < booths[0].z) { sec2 = true; g.say('hotel.l10.s2', { priority: 1 }); }
      if (!sec3 && p.z < booths[1].z) { sec3 = true; g.say('hotel.l10.s3', { priority: 1 }); }
      if (!sec4 && p.z < booths[2].z) { sec4 = true; g.say('hotel.l10.s4', { priority: 1 }); }
    };
    w.hooks.onDeath = (info) => {
      if (info.reason !== 'moved' && Math.random() < 0.6) { game.say('hotel.l10.fall', { priority: 1 }); return true; }
      return info.reason === 'moved';
    };
    w.dance = { tiles, booths, isOn, phaseOf, get frozen() { return frozen; }, P, ON, STEP };
    // bot: hold still during a freeze; otherwise hop on when the next tile is (about to be) lit
    w.botPlan = (g) => {
      const p = g.player, t = w.t;
      const ph = phaseOf(t);
      if (ph === 'freeze' || (ph === 'warn' && t % FREEZE_EVERY > FREEZE_EVERY - FREEZE_LEN - 0.4 && p.grounded)) return { wait: true, x: p.x, z: p.z };
      if (!p.grounded) return null;
      // the next platform ahead: a solid booth needs no timing, a tile has to be lit (and stay lit) when we land
      const nt = tiles.find((tl) => tl.z < p.z - 1), nb = booths.find((b) => b.z < p.z - 1);
      if (nt && !(nb && nb.z > nt.z) && !(mod(t + 0.12 + nt.phase, P) < ON - 0.6)) return { wait: true, x: p.x, z: p.z };
      return null;
    };
    void softTexture; void hotelHalo; void hotelEnv;
  },
};
