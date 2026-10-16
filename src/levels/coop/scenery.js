import * as THREE from 'three';
import { softTexture } from '../../engine/materials.js';

// 2 Player Mode backdrop. Serenity Falls: mountain ridges with waterfalls, floating islands with pines and glowing crystals, a sun or moon,
// aurora at night, and lanterns drifting up past the route. Everything here is scenery (no collision), built once after the level, instanced
// where it is repeated, and laid out along the level's own route so it is still there 600 m down the track.

const PAL = {
  dusk:  { rock: 0x6b5a88, ridge: 0x4d4478, cap: 0xffd9c4, grass: 0x4f9a86, leaf: 0x2f8a72, trunk: 0x4a3326, crystal: 0xff7ad9, fall: 0xffd0b8, lantern: 0xffc27a, sun: 0xffb27a, aurora: null },
  night: { rock: 0x2f3d70, ridge: 0x1a2350, cap: 0xcfe0ff, grass: 0x2f7f86, leaf: 0x1f6c78, trunk: 0x24304a, crystal: 0x5fe3ff, fall: 0x9fd4ff, lantern: 0xffd27a, sun: 0xcfe0ff, aurora: [0x38ffb0, 0x7a5cff] },
  dawn:  { rock: 0x8aa0c8, ridge: 0x6f86b8, cap: 0xffffff, grass: 0x6fb08a, leaf: 0x3f9a72, trunk: 0x5a4636, crystal: 0xffe27a, fall: 0xe8f4ff, lantern: 0xfff0b0, sun: 0xfff0d0, aurora: null },
  storm: { rock: 0x3a465e, ridge: 0x2a3348, cap: 0xcfd8ea, grass: 0x3f6f66, leaf: 0x2f5f58, trunk: 0x2a2a30, crystal: 0x9ac0ff, fall: 0xb8c8e8, lantern: 0xffd27a, sun: 0xaab8d8, aurora: null },
};

const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

let _streak = null, _disc = null, _moon = null;
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
/** Falling-water texture: soft vertical streaks, tileable in y. */
function streakTexture() {
  if (_streak) return _streak;
  const [c, ctx] = canvas(128, 256);
  ctx.clearRect(0, 0, 128, 256);
  const r = mulberry(11);
  for (let i = 0; i < 46; i++) {
    const x = r() * 128, w = 1.5 + r() * 5, a = 0.12 + r() * 0.5, y0 = r() * 256, len = 50 + r() * 150;
    for (const dy of [0, -256]) {
      const g = ctx.createLinearGradient(0, y0 + dy, 0, y0 + dy + len);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x, y0 + dy, w, len);
    }
  }
  const sideFade = ctx.createLinearGradient(0, 0, 128, 0);
  sideFade.addColorStop(0, 'rgba(0,0,0,1)'); sideFade.addColorStop(0.18, 'rgba(0,0,0,0)'); sideFade.addColorStop(0.82, 'rgba(0,0,0,0)'); sideFade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = sideFade; ctx.fillRect(0, 0, 128, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return (_streak = t);
}
function discTexture(kind) {
  if (kind === 'sun' && _disc) return _disc;
  if (kind === 'moon' && _moon) return _moon;
  const S = 256, [c, ctx] = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  if (kind === 'sun') { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,1)'); g.addColorStop(0.24, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
  else { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,1)'); g.addColorStop(0.33, 'rgba(255,255,255,0.3)'); g.addColorStop(0.6, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  if (kind === 'moon') {                                                 // a few darker seas on the disc
    ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(120,140,190,0.35)';
    for (const [x, y, r] of [[0.42, 0.42, 0.07], [0.56, 0.5, 0.05], [0.47, 0.6, 0.045], [0.6, 0.38, 0.03]]) { ctx.beginPath(); ctx.arc(x * S, y * S, r * S, 0, 7); ctx.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (kind === 'sun') _disc = t; else _moon = t;
  return t;
}

const AURORA_VERT = 'varying vec2 vUv; uniform float uTime; void main(){ vUv = uv; vec3 p = position; p.y += sin(uv.x * 40.0 + uTime * 0.35) * 5.0 * uv.y + sin(uv.x * 11.0 - uTime * 0.2) * 8.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }';
const AURORA_FRAG = `varying vec2 vUv; uniform float uTime; uniform vec3 uA; uniform vec3 uB;
void main(){
  float curtain = 0.5 + 0.5 * sin(vUv.x * 90.0 + sin(vUv.x * 17.0 + uTime * 0.25) * 3.0 + uTime * 0.3);
  curtain = pow(curtain, 1.7);
  float band = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
  float edge = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.92, 1.0, vUv.x));
  vec3 col = mix(uA, uB, smoothstep(0.1, 0.9, vUv.y + 0.2 * sin(vUv.x * 6.0 + uTime * 0.1)));
  gl_FragColor = vec4(col * 1.6, curtain * band * edge * 0.55);
}`;

/** Build the world around the route. Call once, after the level has been built. */
export function coopScenery(w, game) {
  const mood = w.coopMood || 'dusk', P = PAL[mood] || PAL.dusk, low = !!game.lowGfx;
  const R = mulberry(7919 + (game.levelIndex || 0) * 101);
  const sp = w.plats.map((q) => q.body).filter((b) => b.enabled !== false);
  if (!sp.length) return;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, minY = 1e9, maxY = -1e9;
  for (const b of sp) {
    minX = Math.min(minX, b.x - b.hx); maxX = Math.max(maxX, b.x + b.hx);
    minZ = Math.min(minZ, b.z - b.hz); maxZ = Math.max(maxZ, b.z + b.hz);
    minY = Math.min(minY, b.top - b.hy * 2); maxY = Math.max(maxY, b.top);
  }
  const cx = (minX + maxX) / 2, len = maxZ - minZ;
  const fogC = new THREE.Color(w.envCfg.fog.color ?? w.envCfg.horizon);
  const clearOf = (x, y, z, r, vr = 24) => !sp.some((b) => Math.abs(b.top - y) < vr && Math.max(Math.abs(b.x - x) - b.hx, 0) ** 2 + Math.max(Math.abs(b.z - z) - b.hz, 0) ** 2 < (r + 10) ** 2);
  const groundY = (z) => { let best = null, bd = 1e9; for (const b of sp) { const d = Math.abs(b.z - z); if (d < bd) { bd = d; best = b; } } return best ? best.top : 0; };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color(), V = new THREE.Vector3(), S = new THREE.Vector3();
  const add = (o) => { o.frustumCulled = false; w.add(o); return o; };

  // ------------------------------------------------------------------ mountain ridges -----------------------------------------
  const rows = [];
  for (let z = minZ - 160; z < maxZ + 160; z += 34 + R() * 10) {
    for (const side of [-1, 1]) {
      rows.push({ x: cx + side * (150 + R() * 150), z: z + R() * 20, h: 70 + R() * 110 + Math.min(80, maxY * 0.4), layer: 1 });
      if (R() < 0.7) rows.push({ x: cx + side * (95 + R() * 60), z: z + R() * 20, h: 35 + R() * 55 + Math.min(40, maxY * 0.2), layer: 0 });
    }
  }
  const cone = new THREE.ConeGeometry(1, 1, 7, 1);
  const mt = new THREE.InstancedMesh(cone, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), rows.length);
  const caps = new THREE.InstancedMesh(cone.clone(), new THREE.MeshStandardMaterial({ color: P.cap, roughness: 0.9, flatShading: true, emissive: P.cap, emissiveIntensity: mood === 'night' ? 0.1 : 0.05 }), rows.length);
  const baseY = minY - 90;
  rows.forEach((r, i) => {
    const rad = r.h * (0.62 + R() * 0.3), yaw = R() * 6.28;
    q.setFromEuler(e.set(0, yaw, 0));
    mt.setMatrixAt(i, m4.compose(V.set(r.x, baseY + r.h / 2, r.z), q, S.set(rad, r.h, rad)));
    col.setHex(P.ridge).lerp(new THREE.Color(P.rock), r.layer * 0.55).lerp(fogC, 0.1 + 0.2 * (1 - r.layer)).multiplyScalar(0.85 + R() * 0.3);
    mt.setColorAt(i, col);
    const ck = 0.3 + R() * 0.1;
    caps.setMatrixAt(i, m4.compose(V.set(r.x, baseY + r.h * (1 - ck / 2) + 0.2, r.z), q, S.set(rad * ck * 1.03, r.h * ck, rad * ck * 1.03)));
  });
  mt.instanceMatrix.needsUpdate = true; if (mt.instanceColor) mt.instanceColor.needsUpdate = true; caps.instanceMatrix.needsUpdate = true;
  add(mt); add(caps);

  // ------------------------------------------------------------------ waterfalls (on the far ridge + off the islands) ------------
  const streak = streakTexture(), falls = [];
  const waterfall = (x, yTop, z, width, drop, face) => {
    const map = streak.clone(); map.needsUpdate = true; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(1, drop / 45);
    const mat = new THREE.MeshBasicMaterial({ map, color: new THREE.Color(P.fall).multiplyScalar(1.5), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, drop), mat);
    m.position.set(x, yTop - drop / 2, z); m.rotation.y = face; add(m);
    const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('puff'), color: P.fall, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    mist.position.set(x, yTop - drop + 2, z); mist.scale.set(width * 3.2, width * 1.6, 1); add(mist);
    falls.push(map);
  };
  const bigFalls = Math.max(2, Math.round(len / 160));
  for (let i = 0; i < bigFalls; i++) {
    const side = i % 2 ? 1 : -1, z = minZ + (len * (i + 0.5)) / bigFalls + (R() - 0.5) * 30;
    const x = cx + side * (118 + R() * 18);
    waterfall(x, baseY + 120 + R() * 30, z, 14 + R() * 8, 150, side > 0 ? -Math.PI / 2 : Math.PI / 2);
  }

  // ------------------------------------------------------------------ floating islands ------------------------------------------
  const isl = [], trees = [], crystals = [], glow = [];
  const want = Math.min(46, Math.round(len / 14) + 8);
  for (let tries = 0, n = 0; n < want && tries < want * 12; tries++) {
    const z = minZ - 40 + R() * (len + 80), side = R() < 0.5 ? -1 : 1;
    const r = 4 + R() * 9, x = cx + side * (28 + R() * 85), y = groundY(Math.min(maxZ, Math.max(minZ, z))) + (-10 + R() * 38);
    if (!clearOf(x, y, z, r + 4)) continue;
    n++; isl.push({ x, y, z, r });
    const nt = 2 + Math.floor(R() * 4);
    for (let k = 0; k < nt; k++) { const a = R() * 6.28, d = R() * r * 0.62, hh = 2.2 + R() * 3.2; trees.push({ x: x + Math.cos(a) * d, y: y + 0.8, z: z + Math.sin(a) * d, h: hh }); }
    if (R() < 0.8) { const a = R() * 6.28, d = r * 0.35 * R(); crystals.push({ x: x + Math.cos(a) * d, y: y + 1.4, z: z + Math.sin(a) * d, s: 0.8 + R() * 1.3 }); }
    if (R() < 0.35) waterfall(x + (cx > x ? r * 0.82 : -r * 0.82), y + 0.4, z, 3 + R() * 3, 55 + R() * 40, cx > x ? Math.PI / 2 : -Math.PI / 2);
  }
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
  const grassMat = new THREE.MeshStandardMaterial({ color: P.grass, roughness: 0.8, flatShading: true });
  isl.forEach((s) => {
    const rock = new THREE.Mesh(new THREE.ConeGeometry(s.r, s.r * (1.2 + R() * 0.8), 7, 1), rockMat.clone());
    rock.material.color.setHex(P.rock).multiplyScalar(0.8 + R() * 0.4); rock.rotation.set(Math.PI, R() * 6.28, 0); rock.position.set(s.x, s.y - s.r * 0.7, s.z); add(rock);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r * 0.97, 0.9, 9), grassMat); top.position.set(s.x, s.y + 0.1, s.z); top.rotation.y = R() * 6; add(top);
  });
  if (trees.length) {
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 1, 5), new THREE.MeshStandardMaterial({ color: P.trunk, roughness: 1 }), trees.length);
    const leaf = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), trees.length * 2);
    trees.forEach((t, i) => {
      trunk.setMatrixAt(i, m4.compose(V.set(t.x, t.y + t.h * 0.2, t.z), q.identity(), S.set(1, t.h * 0.4, 1)));
      for (let k = 0; k < 2; k++) {
        const cw = t.h * (k ? 0.26 : 0.38), ch = t.h * (k ? 0.62 : 0.7);
        leaf.setMatrixAt(i * 2 + k, m4.compose(V.set(t.x, t.y + t.h * (0.42 + k * 0.3) + ch * 0.3, t.z), q.identity(), S.set(cw * 1.5, ch, cw * 1.5)));
        leaf.setColorAt(i * 2 + k, col.setHex(P.leaf).multiplyScalar(0.8 + R() * 0.5 + k * 0.12));
      }
    });
    trunk.instanceMatrix.needsUpdate = true; leaf.instanceMatrix.needsUpdate = true; if (leaf.instanceColor) leaf.instanceColor.needsUpdate = true;
    add(trunk); add(leaf);
  }
  if (crystals.length) {
    const cm = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.crystal).multiplyScalar(2.4), toneMapped: false }), crystals.length);
    crystals.forEach((c, i) => {
      cm.setMatrixAt(i, m4.compose(V.set(c.x, c.y + c.s, c.z), q.setFromEuler(e.set(0, R() * 6, 0)), S.set(c.s * 0.45, c.s * 1.15, c.s * 0.45)));
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: P.crystal, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      g.position.set(c.x, c.y + c.s, c.z); g.scale.setScalar(c.s * 7); add(g); glow.push(g);
    });
    cm.instanceMatrix.needsUpdate = true; add(cm);
  }

  // ------------------------------------------------------------------ sun / moon, aurora ------------------------------------------
  const rig = new THREE.Group(); rig.frustumCulled = false; w.add(rig);                       // follows the camera, like the sky
  const sd = new THREE.Vector3(...w.envCfg.sun.dir).normalize();
  const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTexture(mood === 'night' ? 'moon' : 'sun'), color: new THREE.Color(P.sun).multiplyScalar(mood === 'night' ? 1.3 : 2.2), transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  disc.position.copy(sd).multiplyScalar(430); disc.scale.setScalar(mood === 'night' ? 70 : 120); rig.add(disc);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: P.sun, transparent: true, opacity: mood === 'night' ? 0.35 : 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.position.copy(sd).multiplyScalar(425); halo.scale.setScalar(mood === 'night' ? 300 : 520); rig.add(halo);
  let aurora = null;
  if (P.aurora && !low) {
    aurora = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(P.aurora[0]) }, uB: { value: new THREE.Color(P.aurora[1]) } },
      vertexShader: AURORA_VERT, fragmentShader: AURORA_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(390, 390, 130, 96, 1, true, Math.PI * 0.55, Math.PI * 0.9), aurora);
    band.position.y = 150; band.frustumCulled = false; rig.add(band);
  }

  // ------------------------------------------------------------------ lanterns drifting up past the route --------------------------
  const nL = low ? 80 : Math.min(260, Math.max(110, Math.round(len / 3.5)));
  const lp = new Float32Array(nL * 3), spd = new Float32Array(nL), y0 = minY - 8, y1 = maxY + 34;
  for (let i = 0; i < nL; i++) { lp[i * 3] = cx + (R() - 0.5) * 90; lp[i * 3 + 1] = y0 + R() * (y1 - y0); lp[i * 3 + 2] = minZ - 20 + R() * (len + 40); spd[i] = 0.35 + R() * 0.7; }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const lanterns = new THREE.Points(lg, new THREE.PointsMaterial({ map: softTexture('glow'), color: new THREE.Color(P.lantern).multiplyScalar(1.6), size: 1.7, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  add(lanterns);

  // ------------------------------------------------------------------ water under everything (if the level has no lake of its own) --
  if (!w._lake) {
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: P.ridge, roughness: 0.18, metalness: 0.55, transparent: true, opacity: 0.9 }));
    wm.rotation.x = -Math.PI / 2; wm.position.y = Math.min(-34, minY - 34); add(wm);
    w.updaters.push(() => { const p = game.player; wm.position.x = p.x; wm.position.z = p.z; });
  }

  // ------------------------------------------------------------------ animation --------------------------------------------------
  const prev = w.hooks.frame;
  w.hooks.frame = (dt, g) => {
    prev?.(dt, g);
    const t = w.t;
    rig.position.copy(g.camera.position);
    for (const tx of falls) tx.offset.y -= dt * 0.55;
    if (aurora) aurora.uniforms.uTime.value = t;
    const a = lg.attributes.position.array;
    for (let i = 0; i < nL; i++) { a[i * 3 + 1] += spd[i] * dt; a[i * 3] += Math.sin(t * 0.4 + i) * dt * 0.25; if (a[i * 3 + 1] > y1) a[i * 3 + 1] = y0; }
    lg.attributes.position.needsUpdate = true;
    for (let i = 0; i < glow.length; i++) glow[i].material.opacity = 0.55 + 0.2 * Math.sin(t * 1.3 + i * 1.7);
  };
}
