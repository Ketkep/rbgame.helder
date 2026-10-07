import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture } from '../../engine/materials.js';
import { roomShell, hotelHalo, GOLD } from './kit.js';

// Hotel level 6 — "Soufflé" (Medium · Restaurant). The kitchen. The chef made a soufflé. It is rising. You are above it,
// for now. Climb the kitchen (counters, pots, sliding trays, cookie sheets) past steam vents, swinging pans and hot
// burners to the roof hatch. One of the exits on the way is not an exit.

const H = 44;
const STEEL = 0xf0f4fa;

export default {
  id: 'hotel-6',
  name: 'Soufflé',
  music: 'hotel_kitchen',
  completeQuip: 'It rose. You rose faster. Spiritually, you are now a pastry chef.',

  build(w, game) {
    w.env({
      top: 0x120a08, horizon: 0x3a1a10, bottom: 0x0b0605,
      fog: { color: 0x2a140c, near: 40, far: 150 },
      sun: { color: 0xffc890, intensity: 0.4, dir: [0.3, 0.8, 0.5], shadow: false },
      hemi: { sky: 0xffe0b8, ground: 0x8a5a40, intensity: 0.75 },
      exposure: 0.9, stars: 0,
      bloom: { strength: 0.5, radius: 0.7, threshold: 0.95 },
      motes: { color: 0xffd0a0, count: 160, size: 0.09, opacity: 0.55 },
      envMap: { top: 0xffe3b8, mid: 0x6a3a2a, bottom: 0x120c0a, intensity: 0.4, lights: [{ pos: [0, 10, 0], w: 16, h: 16, color: 0xffe2b0, intensity: 2.4 }, { pos: [-14, 3, 0], w: 6, h: 8, color: 0xffa060, intensity: 1.5 }] },
    });
    w.setTheme({ tex: 'metal', color: STEEL, trim: null, edge: null, edgeOpacity: 0, roughness: 0.35, metalness: 0.55, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.spawn = { x: 0, y: 1.0, z: 9, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -20;
    roomShell(w, { x0: -14, x1: 14, z0: -34, z1: 22, yb: -12, H, wallTex: 'tile', wallColor: 0xe9ecef, pilasterEvery: 13, lamps: false });
    w.plat({ x: 0, y: -11.5, z: -6, w: 28, d: 56, h: 1, tex: 'tile', color: 0x3a3030, roughness: 0.9 });
    w.light(0xffb070, 22, 40, 0, 6, 4); w.light(0xffa060, 20, 40, 0, 16, -12); w.light(0xff9a50, 18, 40, 0, 28, 4); w.light(0xffa868, 16, 40, 0, 36, -16);

    // ---- the route -----------------------------------------------------------------------------------
    const R = [];
    const leg = (pts) => pts.forEach((p) => R.push(p));
    // leg A: north along the middle, a gentle warm-up (short hops)
    for (let i = 0; i < 9; i++) leg([{ x: i === 0 ? 0 : (i % 2 ? 1.4 : -1.4), z: 8 - 3.7 * i, y: 1.0 + 0.95 * i }]);
    R.push({ x: -5, z: -25.6, y: 9.6, big: true });
    // leg B: south along the west side (longer gaps)
    for (let i = 0; i < 9; i++) leg([{ x: -9.4 + (i % 2 ? 1.8 : 0), z: -21.6 + 3.9 * i, y: 10.5 + 0.95 * i }]);
    R.push({ x: -4.5, z: 14.4, y: 19.1, big: true });
    // leg C: north along the east side (longer still, narrower)
    for (let i = 0; i < 8; i++) leg([{ x: 2.6 + (i % 2 ? 2.0 : 0), z: 10.8 - 4.1 * i, y: 20.0 + 0.95 * i }]);
    R.push({ x: 4.6, z: -22.4, y: 27.7, big: true });
    const TYPES = {   // index -> special platform
      3: 'board', 5: 'tray', 7: 'cookie', 8: 'pot',
      11: 'board', 13: 'burner', 14: 'tray', 16: 'pot', 17: 'burner', 18: 'cookie',
      21: 'cookie', 22: 'board', 24: 'tray', 26: 'burner', 27: 'cookie', 28: 'board',
    };
    const plats = [];
    const path = (p) => { p.o.path = true; return p; };
    R.forEach((p, i) => {
      const type = p.big ? 'big' : TYPES[i] || 'steel';
      let o = { x: p.x, y: p.y, z: p.z, w: 3.0, d: 3.0, h: 0.5, tex: 'metal', color: STEEL, roughness: 0.3, metalness: 0.7, radius: 0.05, trim: 0xffc060 };
      if (type === 'big') o = { ...o, w: p.x === -4.5 ? 8 : 5, d: 3.4, h: 0.7, tex: 'marble', color: 0xd8d4cc, roughness: 0.3, metalness: 0 };
      if (type === 'board') o = { ...o, w: 2.0, d: 2.0, h: 0.25, tex: 'wood', color: 0xd9b27c, roughness: 0.6, metalness: 0 };
      if (type === 'pot') o = { ...o, w: 2.4, d: 2.4, h: 0.4, color: 0x555a66, roughness: 0.25, metalness: 0.95, radius: 0.18 };
      if (type === 'cookie') o = { ...o, w: 2.4, d: 2.4, h: 0.15, tex: 'stage', color: 0xc6b08a, roughness: 0.7, metalness: 0.3 };
      if (type === 'tray') o = { ...o, w: 2.6, d: 2.2, h: 0.2, color: 0xe0e4ea, roughness: 0.2, metalness: 0.9 };
      if (type === 'burner') o = { ...o, w: 3.0, d: 3.0, h: 0.5, color: 0x2a2c34, roughness: 0.4, metalness: 0.8 };
      const pl = path(w.plat(o));
      plats.push({ pl, type, i, ...p });
      if (type === 'tray') {
        const A = i > 20 ? 2.4 : 1.8, per = i > 20 ? 2.6 : 3.4;
        w.mover(pl, (t) => ({ x: Math.sin(t * Math.PI * 2 / per + i) * A }));
      } else if (type === 'cookie') w.crumble(pl, { delay: 0.55, gone: 3.2 });
      // legs under the platform: a steel stack to the floor so nothing floats
      if (type !== 'tray') w.box({ x: p.x, y: (p.y - 0.4 - 0) / 2, z: p.z, w: type === 'big' ? 3.8 : 1.2, h: p.y - 0.4, d: type === 'big' ? 2.4 : 1.2, color: 0x9aa0aa, metal: 0.7, rough: 0.4, shadow: false });
    });
    // checkpoints on the big platforms (and one early on)
    w.checkpoint({ x: R[4].x, y: R[4].y, z: R[4].z, real: true });
    w.checkpoint({ x: R[9].x, y: R[9].y, z: R[9].z, real: true });
    w.checkpoint({ x: R[19].x, y: R[19].y, z: R[19].z, real: true });
    // the goal: a roof hatch at the top
    const top = R[R.length - 1];
    w.sign({ text: 'ROOF ACCESS', x: top.x, y: top.y + 3.6, z: top.z - 1.8, w: 4.4, h: 0.8, color: '#ffd21f', double: false, tw: 1024, size: 66 });
    w.goal({ x: top.x, y: top.y, z: top.z - 0.4, color: GOLD, onReach: () => { game.say('hotel.l6.done', { priority: 2 }); game.completeLevel(); } });

    // ---- burners: a glowing ring that turns white-hot on a beat --------------------------------------------
    const burnerMat = { off: glowMaterial(0x7a2010, 0.9), warn: glowMaterial(0xff7a30, 1.8), on: glowMaterial(0xffe8c0, 2.6) };
    const burners = [];
    const BURN_P = 4.2;
    plats.filter((p) => p.type === 'burner').forEach((p, k) => {
      const hz = w.hazard({ x: p.x, y: p.y + 0.22, z: p.z, w: 2.9, h: 0.44, d: 2.9, color: 0xff6a20 });
      hz.core.visible = false; hz.shell.visible = false;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 8, 28), burnerMat.off); ring.rotation.x = Math.PI / 2; ring.position.set(p.x, p.y + 0.06, p.z); w.add(ring);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 8, 24), burnerMat.off); ring2.rotation.x = Math.PI / 2; ring2.position.set(p.x, p.y + 0.06, p.z); w.add(ring2);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.4, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); flame.position.set(p.x, p.y + 0.8, p.z); w.add(flame);
      hz.enabled = false; hz.group.visible = false; flame.visible = false;
      hz.predict = (t) => ((((t + k * 1.1) % BURN_P) + BURN_P) % BURN_P) < 1.6;
      burners.push({ hz, ring, ring2, flame, ph: k * 1.1 });
    });
    w.onUpdate((dt, t) => {
      for (const b of burners) {
        const u = (((t + b.ph) % BURN_P) + BURN_P) % BURN_P;
        const state = u < 1.6 ? 'on' : u < 2.3 ? 'warn' : 'off';
        const on = state === 'on';
        if (b.hz.enabled !== on) { b.hz.enabled = on; b.hz.group.visible = on; b.flame.visible = on; }
        const m = burnerMat[state]; if (b.ring.material !== m) { b.ring.material = m; b.ring2.material = m; }
        if (on) b.flame.scale.y = 0.85 + 0.25 * Math.sin(t * 22);
      }
    });

    // ---- steam jets from below, in some of the gaps (time your jump) -------------------------------------------
    const vents = [];
    const VENT_P = 3.6;
    for (const k of [11, 20, 24]) {
      const a = plats[k], b = plats[k + 1]; if (!a || !b) continue;
      const vx = (a.x + b.x) / 2, vz = (a.z + b.z) / 2, low = Math.min(a.y, b.y);
      const hz = w.hazard({ x: vx, y: low + 1.5, z: vz, w: 2.0, h: 5.5, d: 2.0, color: 0xdde8ff });
      hz.core.visible = false; hz.shell.visible = false;
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.2, 8, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xeef4ff, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.y = -1.3; hz.group.add(cone);
      const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('puff'), color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })); puff.scale.set(3.2, 3.2, 1); puff.position.y = 2.2; hz.group.add(puff);
      // the pipe it comes out of (always there, so you can read the timing)
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 8, 10), plainMaterial(0x8a8d95, { metalness: 0.9, roughness: 0.35 })); pipe.position.set(vx, low - 4.3, vz); w.add(pipe);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glowMaterial(0x40ff88, 1.6)); lamp.position.set(vx, low - 0.5, vz); w.add(lamp);
      hz.enabled = false; hz.group.visible = false;
      hz.predict = (t) => { const u = (((t + k * 0.9) % VENT_P) + VENT_P) % VENT_P; return u > 1.2 && u < 2.5; };
      vents.push({ hz, puff, lamp, ph: k * 0.9 });
    }
    const LAMPM = { off: glowMaterial(0x40ff88, 1.6), warn: glowMaterial(0xffc040, 1.8), on: glowMaterial(0xff3a46, 2.0) };
    w.onUpdate((dt, t) => {
      for (const v of vents) {
        const u = (((t + v.ph) % VENT_P) + VENT_P) % VENT_P;
        const on = u > 1.2 && u < 2.5;
        const warn = u > 0.7 && u <= 1.2;
        if (v.hz.enabled !== on) { v.hz.enabled = on; v.hz.group.visible = on; }
        v.lamp.material = on ? LAMPM.on : warn ? LAMPM.warn : LAMPM.off;
        if (on) v.puff.material.opacity = 0.35 + 0.2 * Math.sin(t * 17);
      }
    });

    // ---- swinging pans across some gaps ------------------------------------------------------------------------
    for (const k of [6, 15, 22]) {
      const a = plats[k], b = plats[k + 1]; if (!a || !b) continue;
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, my = Math.max(a.y, b.y) + 1.15;
      const hz = w.hazard({ x: mx, y: my, z: mz, w: 1.5, h: 0.5, d: 1.5, color: 0xff3a46, move: (t) => ({ x: Math.sin(t * 1.9 + k) * 2.6 }) });
      hz.core.visible = false; hz.shell.visible = false;
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.62, 0.16, 20), plainMaterial(0x2c2d33, { metalness: 0.9, roughness: 0.3 })); pan.castShadow = true; hz.group.add(pan);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.16), plainMaterial(0x2c2d33, { metalness: 0.9, roughness: 0.3 })); handle.position.set(1.2, 0, 0); hz.group.add(handle);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 8, 6), plainMaterial(0x8a8d95, { metalness: 0.9, roughness: 0.4 })); chain.position.y = 4.1; hz.group.add(chain);
    }

    // ---- the fake exit (a door on the west wall at about the middle of leg B) --------------------------------------
    const fe = { x: -13.2, y: 14.1, z: -6 };
    w.plat({ x: -11.6, y: fe.y - 0.1, z: fe.z, w: 3.2, d: 3.6, h: 0.3, tex: 'metal', color: STEEL, roughness: 0.3 });   // a little landing in front of the door (reachable from leg B)
    w.box({ x: -13.35, y: fe.y + 1.6, z: fe.z, w: 0.3, h: 3.2, d: 2.4, color: 0x1f2a22, rough: 0.6 });
    w.sign({ text: 'EXIT', x: -13.15, y: fe.y + 3.7, z: fe.z, w: 2.0, h: 0.7, rotY: Math.PI / 2, color: '#6cf0b2', double: false, tw: 512, size: 110, glow: true });
    w.sign({ text: '→ EXIT', x: -13.18, y: fe.y + 1.6, z: fe.z, w: 2.2, h: 1.0, rotY: Math.PI / 2, color: '#6cf0b2', double: false, tw: 512, size: 100, glow: true });
    w.trigger({ x: fe.x + 1.2, y: fe.y + 1.4, z: fe.z, w: 2.2, h: 2.8, d: 2.4, once: false, onEnter: () => { game.say('hotel.l6.fakeexit', { priority: 2 }); game.kill('oven'); } });

    // ---- decor: ovens, pot racks, hanging pans --------------------------------------------------------------
    for (let z = 12; z > -32; z -= 9) for (const sx of [-1, 1]) {
      w.box({ x: sx * 13.1, y: 2.0, z, w: 1.6, h: 4.0, d: 5.5, color: 0x8b9099, metal: 0.8, rough: 0.35, shadow: false });
      w.box({ x: sx * 12.2, y: 1.9, z, w: 0.12, h: 2.6, d: 2.8, color: 0x15161a, rough: 0.3, shadow: false });
      w.box({ x: sx * 12.17, y: 3.4, z, w: 0.1, h: 0.14, d: 2.0, glow: 0xff7a30, glowIntensity: 1.3, shadow: false });
    }
    for (const [x, y, z] of [[-4, 36, -14], [6, 31, 6], [-8, 25, -10], [10, 40, -20]]) {
      for (let k = 0; k < 4; k++) { const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.12, 14), plainMaterial(0x30323a, { metalness: 0.9, roughness: 0.35 })); pan.position.set(x + k * 1.1, y - 0.8, z); w.add(pan); }
      w.box({ x: x + 1.7, y, z, w: 5, h: 0.12, d: 0.12, color: 0x8a8d95, metal: 0.9, rough: 0.35, shadow: false });
    }
    for (let y = 8; y < 42; y += 8) for (const z of [-26, 14]) { w.box({ x: 0, y, z, w: 26, h: 0.3, d: 0.3, color: 0x6f7480, metal: 0.8, rough: 0.4, shadow: false }); hotelHalo(w, 0, y - 0.5, z, 8, 0xffa860, 0.14); }
    w.sign({ text: 'KITCHEN · STAFF ONLY', x: 0, y: 5.5, z: 17.4, w: 7, h: 0.8, color: '#ffd21f', double: false, tw: 1024, size: 54, rotY: Math.PI });

    // ---- the soufflé ----------------------------------------------------------------------------------------------
    let startY = -5, tStart = 0, delay = 6;
    const speed = () => (game.baby ? 0.46 : 0.58) * (w.souffle ? w.souffle.scale : 1);
    const foamTop = (t) => startY + Math.max(0, t - tStart - delay) * speed();
    const foam = w.hazard({ x: 0, y: -12, z: -6, w: 27.5, h: 14, d: 55, color: 0xffd9a0, move: (t) => ({ y: foamTop(t) + 5 }) });
    foam.core.visible = false; foam.shell.visible = false;
    // bubbly cream surface + a thick body
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xf2dcae, roughness: 0.85, emissive: 0x3a2410, emissiveIntensity: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(27.5, 14, 55), creamMat); body.position.y = 0; foam.group.add(body);
    const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 8), creamMat, 150);
    const seeds = []; const m4 = new THREE.Matrix4();
    for (let i = 0; i < 150; i++) seeds.push([Math.random() * 25 - 12.5, Math.random() * 51 - 25.5, 0.5 + Math.random() * 1.0, Math.random() * 6]);
    foam.group.add(bubbles);
    const crown = new THREE.Mesh(new THREE.PlaneGeometry(27.5, 55), new THREE.MeshBasicMaterial({ map: softTexture('puff'), color: 0xffe8c0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); crown.rotation.x = -Math.PI / 2; crown.position.y = 7.9; foam.group.add(crown);
    w.onUpdate((dt, t) => {
      for (let i = 0; i < seeds.length; i++) { const [sx, sz, s, ph] = seeds[i]; m4.makeScale(s, s * (0.7 + 0.3 * Math.sin(t * 2 + ph)), s); m4.setPosition(sx, 7.1 + 0.25 * Math.sin(t * 1.5 + ph), sz); bubbles.setMatrixAt(i, m4); }
      bubbles.instanceMatrix.needsUpdate = true;
    });
    w.onRespawn(() => { startY = Math.max(-5, w.respawn.y - 7); tStart = w.t; delay = 2.8; });

    // ---- the host ------------------------------------------------------------------------------------------------------
    let t0 = 0, intro = false, started = false, near = false, said = {};
    const once = (k, key = k) => { if (said[k]) return; said[k] = true; game.say(key, { priority: 1 }); };
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      const p = g.player;
      if (!intro && t0 > 1.0) { intro = true; g.say('hotel.l6.intro'); g.say('hotel.l6.intro2'); }
      if (!started && w.t - tStart > delay) { started = true; g.say('hotel.l6.rise', { priority: 1 }); }
      if (!near && p.y - foamTop(w.t) < 5 && w.t - tStart > delay) { near = true; g.say('hotel.l6.near', { priority: 1 }); }
      if (p.y > 3.5) once('tray', 'hotel.l6.tray');
      if (p.y > 8.5) once('legb', 'hotel.l6.legb');
      if (p.y > 12) once('burner', 'hotel.l6.burner');
      if (p.y > 15) once('exit', 'hotel.l6.exit');
      if (p.y > 20) once('pans', 'hotel.l6.pans');
      if (p.y > 25) once('top', 'hotel.l6.top');
    };
    w.hooks.onCheckpoint = () => { game.say('hotel.l6.cp', { priority: 1 }); near = false; };
    w.hooks.onDeath = (info) => {
      if (info.reason === 'hazard' && Math.random() < 0.65) {
        const p = game.player, f = foamTop(w.t);
        game.say(p.y < f + 1.2 ? 'hotel.l6.foam' : 'hotel.l6.burn', { priority: 2 }); return true;
      }
      return false;
    };
    w.souffle = { scale: 1, foamTop, plats, burners, vents, get startY() { return startY; }, get tStart() { return tStart; } };
  },
};
