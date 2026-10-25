import * as THREE from 'three';
import { softTexture } from '../../engine/materials.js';
import { hp, box } from './kit.js';
import { horrorSurface } from './materials.js';

// Chapter 4 (Hydrotherapy) toolkit: dark reflective water that rises on the world clock, wading/drowning rules for the local player, depth
// gauges and beacons that telegraph the tide, two-handed valve stations, stairs/ledges, and a few hydro-ward props.
// Everything time-driven is a pure function of the world clock (w.t) so both machines see the same tide.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;

/** A repeating tide: low for `low` of the period, rises over `rise`, high for `high`, then falls. Returns { y, warn (0..1) }. */
export function tideCycle(t, { lo = 0.12, hi = 2.05, period = 56, low = 0.5, rise = 0.18, high = 0.14, off = 0, lead = 0.11 } = {}) {
  const s = (((t + off) % period) + period) % period / period;
  const fall = 1 - low - rise - high;
  let y;
  if (s < low) y = lo; else if (s < low + rise) y = lerp(lo, hi, smooth((s - low) / rise)); else if (s < low + rise + high) y = hi; else y = lerp(hi, lo, smooth((s - low - rise - high) / fall));
  const warn = s >= low - lead && s < low + rise + high ? 1 : 0;
  return { y, warn, s, period };
}

// ---------------------------------------------------------------- textures ------------------------------------------------------
let rippleCache = null, foamCache = null;
function rippleTexture() {
  if (rippleCache) return rippleCache;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const img = g.createImageData(N, N);
  const waves = [[3, 1, 0.5], [1, 4, 1.7], [5, 3, 2.9], [2, 7, 0.3], [8, 2, 4.1], [6, 9, 5.2], [11, 5, 1.1]];
  const hgt = (u, v) => { let s = 0; for (const [k, l, p] of waves) s += Math.sin(6.2832 * (k * u + l * v) + p) / (k + l); return s; };
  const e = 1 / N;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    const dx = (hgt(u + e, v) - hgt(u - e, v)) / (2 * e), dy = (hgt(u, v + e) - hgt(u, v - e)) / (2 * e);
    let nx = -dx * 0.012, ny = -dy * 0.012, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * N + x) * 4; img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return (rippleCache = t);
}
function foamTexture() {
  if (foamCache) return foamCache;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  let a = 99; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  g.clearRect(0, 0, N, N);
  for (let i = 0; i < 46; i++) {
    const x = r() * N, y = r() * N, rad = 6 + r() * 26, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(210,225,220,${0.25 + r() * 0.35})`); gr.addColorStop(1, 'rgba(210,225,220,0)'); g.fillStyle = gr;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
  }
  g.strokeStyle = 'rgba(200,220,215,0.35)'; g.lineWidth = 1.2;
  for (let i = 0; i < 26; i++) { const x = r() * N, y = r() * N, len = 20 + r() * 50; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 16, x + len * 0.7, y + (r() - 0.5) * 16, x + len, y + (r() - 0.5) * 8); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return (foamCache = t);
}

// ---------------------------------------------------------------- caustics (animated additive light on walls and floor) ----------
const CAUSTIC_VERT = `varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const CAUSTIC_FRAG = `
  uniform float uTime, uSurf, uInt, uFloor; uniform vec3 uCam; uniform vec3 uTP[2]; uniform vec3 uTD[2]; uniform float uOn[2]; uniform vec3 uCol; uniform float uKind;
  varying vec3 vW;
  #define TAU 6.28318530718
  float caustic(vec2 uv, float time){
    vec2 p = mod(uv * TAU, TAU) - 250.0; vec2 i = p; float c = 1.0; float inten = .005;
    for (int n = 0; n < 4; n++) { float t = time * (1.0 - (3.5 / float(n + 1))); i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x)); c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten))); }
    c /= 4.0; c = 1.17 - pow(c, 1.4); return pow(abs(c), 8.0);
  }
  void main(){
    float dy = uSurf - vW.y;
    float vert = uKind > 0.5 ? exp(-max(uSurf - uFloor, 0.0) * 0.55) : smoothstep(-1.4, 0.05, dy) * exp(-max(dy, 0.0) * 0.55);
    vec2 uv = uKind > 0.5 ? vW.xz * 0.16 : vec2(vW.x + vW.z, vW.y) * 0.16;
    float c = caustic(uv, uTime * 0.5 + 23.0) * 0.8 + caustic(uv * 1.7 + 3.1, uTime * 0.37 + 7.0) * 0.5;
    float lit = 0.0;
    for (int k = 0; k < 2; k++) { vec3 d = vW - uTP[k]; float L = length(d); float cone = smoothstep(0.82, 0.97, dot(d / max(L, 0.001), uTD[k])); lit = max(lit, cone * exp(-L * 0.07) * uOn[k]); }
    float cd = length(vW - uCam); float amb = 0.2 * exp(-cd * 0.12);
    float a = c * (lit + amb) * vert * uInt;
    gl_FragColor = vec4(uCol * a, 1.0);
  }`;
const causticMat = (W, kind) => new THREE.ShaderMaterial({
  uniforms: W.uni ? { ...W.uni, uKind: { value: kind } } : {},
  vertexShader: CAUSTIC_VERT, fragmentShader: CAUSTIC_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
});

// ---------------------------------------------------------------- the toolkit -----------------------------------------------------
export function hydroEnv(w, game, H) {
  const c = w.coop, S = H.S, me = c.me, A = game.audio;
  const HY = { waters: [], air: 3, under: 0, depth: 0, bot: !!window.__noRender, drowned: 0 };
  w.moveMul = { speed: 1, jump: 1 };
  w.stepHeight = 0.45;
  const fog = w.scene.fog, fogBase = { color: fog.color.clone(), density: fog.density }, fogUnder = new THREE.Color(0x041e1c);

  // ---- sfx: small water sounds of our own (splash, bubbles, gasp, underwater bed) -------------------------------------------------
  const sfx = {};
  const noise = (f, q, dur, vol, pan = 0, type = 'bandpass', sweep = 0) => {
    const ctx = A.ctx; if (!ctx || !A.noiseBuf) return;
    const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = A.noiseBuf; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(60, f + sweep), t + dur); fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; s.connect(fl); fl.connect(g); if (p) { p.pan.value = pan; g.connect(p); p.connect(A.master); } else g.connect(A.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  };
  const tone = (f, dur, vol, slide = 0) => {
    const ctx = A.ctx; if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.05);
  };
  sfx.splash = (vol = 0.1, pan = 0, deep = 0) => noise(900 - deep * 400, 0.9, 0.28 + deep * 0.15, vol, pan, 'bandpass', -500);
  sfx.bubble = () => { const f = 380 + Math.random() * 500; tone(f, 0.1, 0.05, f * 0.8); };
  sfx.gasp = () => noise(1400, 1.5, 0.4, 0.12, 0, 'bandpass', -600);
  sfx.slosh = (vol = 0.12) => noise(300, 0.7, 1.4, vol, (Math.random() - 0.5) * 0.8, 'lowpass', -120);
  let bed = null;
  const startBed = () => {
    const ctx = A.ctx; if (bed || !ctx || !A.noiseBuf) return;
    const s = ctx.createBufferSource(); s.buffer = A.noiseBuf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 240; const g = ctx.createGain(); g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(A.master); s.start(); bed = { s, g, fl };
  };
  w.disposers.push(() => { try { bed?.s.stop(); bed?.g.disconnect(); } catch { /* ignore */ } bed = null; document.getElementById('ht-hud')?.remove(); });
  HY.sfx = sfx;

  // ---- water ------------------------------------------------------------------------------------------------------------------
  const camP = new THREE.Vector3(), tP = [new THREE.Vector3(), new THREE.Vector3()], tD = [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -1)];
  const rings = [];
  const ringGeo = new THREE.RingGeometry(0.82, 1, 40); ringGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xa8c4c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.visible = false; m.renderOrder = 4; w.add(m); rings.push({ m, t: 9, life: 1.5, size: 1 }); }
  let ringI = 0;
  HY.ring = (x, y, z, size = 1, life = 1.5) => { const r = rings[ringI++ % rings.length]; r.m.position.set(x, y + 0.012, z); r.t = 0; r.life = life; r.size = size; r.m.visible = true; };

  HY.waterAt = (x, z, y = 0) => { for (const W of HY.waters) if (x > W.x0 && x < W.x1 && z > W.z0 && z < W.z1 && y > W.floorY - 4.5) return W; return null; };

  /** o: { x, z, w, d, floorY, level: (t) => y | { y, warn }, height (walls to dress with caustics), opacity } */
  HY.water = (o) => {
    const W = { ...o, floorY: o.floorY ?? 0, x0: o.x - o.w / 2, x1: o.x + o.w / 2, z0: o.z - o.d / 2, z1: o.z + o.d / 2, y: 0, warn: 0, height: o.height ?? 4.8 };
    const read = (t) => { const v = o.level(t); if (typeof v === 'number') { W.y = v; W.warn = 0; } else { W.y = v.y; W.warn = v.warn || 0; } };
    read(0);
    const normal = rippleTexture().clone(); normal.needsUpdate = true; normal.repeat.set(o.w / 3.2, o.d / 3.2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x07201f, roughness: 0.05, metalness: 0.55, transparent: true, opacity: o.opacity ?? 0.9, normalMap: normal, normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 1.8, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.d), mat); mesh.rotation.x = -Math.PI / 2; mesh.position.set(o.x, W.y, o.z); mesh.renderOrder = 3; w.add(mesh);
    const foamT = foamTexture().clone(); foamT.needsUpdate = true; foamT.repeat.set(o.w / 7, o.d / 7);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.d), new THREE.MeshBasicMaterial({ map: foamT, color: 0x6f8f8a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); foam.rotation.x = -Math.PI / 2; foam.position.set(o.x, W.y + 0.006, o.z); foam.renderOrder = 3; w.add(foam);
    // foam flecks and floating dust that drift on the surface
    const n = o.flecks ?? clamp(Math.floor(o.w * o.d * 0.35), 30, 200), pos = new Float32Array(n * 3), seeds = [];
    for (let i = 0; i < n; i++) seeds.push({ x: W.x0 + Math.random() * o.w, z: W.z0 + Math.random() * o.d, vx: (Math.random() - 0.5) * 0.12, vz: (Math.random() - 0.5) * 0.12, p: Math.random() * 6 });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flecks = new THREE.Points(geo, new THREE.PointsMaterial({ map: softTexture('glow'), color: 0x9fb8b2, size: 0.2, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })); flecks.frustumCulled = false; w.add(flecks);
    // caustics: floor + four walls (torch-aware: they only show where a light falls)
    W.uni = {
      uTime: { value: 0 }, uSurf: { value: W.y }, uInt: { value: o.caustics ?? 2.3 }, uFloor: { value: W.floorY }, uCam: { value: camP }, uTP: { value: tP }, uTD: { value: tD }, uOn: { value: [1, 0] }, uCol: { value: new THREE.Color(0.45, 0.85, 0.8) },
    };
    if (o.caustics !== 0 && !game.lowGfx) {
      const mk = (kind, wd, ht, x, y, z, rx, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), causticMat(W, kind)); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.renderOrder = 5; m.frustumCulled = false; w.add(m); return m; };
      const hh = W.height;
      mk(1, o.w, o.d, o.x, W.floorY + 0.04, o.z, -Math.PI / 2, 0);
      const e = 0.03;
      mk(0, o.w, hh, o.x, W.floorY + hh / 2, W.z0 + e, 0, 0); mk(0, o.w, hh, o.x, W.floorY + hh / 2, W.z1 - e, 0, Math.PI);
      mk(0, o.d, hh, W.x0 + e, W.floorY + hh / 2, o.z, 0, Math.PI / 2); mk(0, o.d, hh, W.x1 - e, W.floorY + hh / 2, o.z, 0, -Math.PI / 2);
    }
    W.mesh = mesh; W.foam = foam; W.normal = normal; W.foamT = foamT; W.flecks = { pts: flecks, seeds, pos };
    HY.waters.push(W);
    w.updaters.push(() => { read(w.t); });                                  // logic clock: the level of every water is a function of w.t
    return W;
  };

  // ---- player: wading speed, drowning (3 s warning), HUD, underwater look -------------------------------------------------------
  const hud = document.createElement('div'); hud.id = 'ht-hud';
  hud.style.cssText = 'position:fixed;left:50%;bottom:22%;transform:translateX(-50%);z-index:30;pointer-events:none;text-align:center;font:700 13px "Archivo Black",Impact,sans-serif;letter-spacing:.28em;color:#e8f4f0;opacity:0;transition:opacity .15s;text-shadow:0 0 8px #000';
  hud.innerHTML = '<div id="ht-air-t" style="margin-bottom:8px">HOLD ON</div><div style="width:260px;height:10px;border:1px solid #9fc4bc;background:rgba(0,0,0,.55)"><i id="ht-air-b" style="display:block;height:100%;width:100%;background:#d83a3a"></i></div>';
  document.body.appendChild(hud);
  const airB = hud.querySelector('#ht-air-b'), airT = hud.querySelector('#ht-air-t');

  const feet = () => { const p = game.player; const W = HY.waterAt(p.x, p.z, p.y); return { W, d: W ? W.y - p.y : -9, head: W ? W.y - (p.y + 1.62) : -9 }; };
  w.updaters.push((dt) => {
    const p = game.player, f = feet(); HY.W = f.W; HY.depth = f.d;
    const d = f.d;
    w.moveMul.speed = d < 0.12 ? 1 : d < 0.5 ? lerp(1, 0.66, (d - 0.12) / 0.38) : d < 1.3 ? lerp(0.66, 0.46, (d - 0.5) / 0.8) : lerp(0.46, 0.36, clamp((d - 1.3) / 0.9, 0, 1));
    w.moveMul.jump = d < 0.3 ? 1 : lerp(1, 0.68, clamp((d - 0.3) / 1.2, 0, 1));
    const sub = f.head > 0;
    HY.submerged = sub;
    if (game.state !== 'playing') { HY.air = 3; return; }
    if (sub) {
      HY.air = Math.max(0, HY.air - dt);
      if (HY.air <= 0 && !HY.bot) { HY.air = 3; HY.drowned++; game.kill('drowned'); c.tell(me, 'lt.c4.drown', { priority: 2 }); }
    } else HY.air = Math.min(3, HY.air + dt * 2.6);
    void p;
  });

  // ---- drips: falling drops that ring the water (or the floor) ---------------------------------------------------------------------
  HY.drips = [];
  HY.drip = (x, y, z, every = 3) => HY.drips.push({ x, y, z, every, next: Math.random() * every });
  const dropGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.16, 5);
  const drops = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(dropGeo, new THREE.MeshBasicMaterial({ color: 0x9fc4cc, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; w.add(m); return { m, on: false, vy: 0, x: 0, z: 0, fl: 0 }; });
  let dropI = 0;

  // ---- ambient flavour and visuals (per frame) ---------------------------------------------------------------------------------------
  const bubGeo = new THREE.BufferGeometry(), bubPos = new Float32Array(40 * 3), bubV = Array.from({ length: 40 }, () => 0.3 + Math.random() * 0.6);
  bubGeo.setAttribute('position', new THREE.BufferAttribute(bubPos, 3));
  const bubbles = new THREE.Points(bubGeo, new THREE.PointsMaterial({ map: softTexture('glow'), color: 0xbfe0dc, size: 0.07, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); bubbles.frustumCulled = false; bubbles.visible = false; w.add(bubbles);
  const qv = new THREE.Quaternion(), ev = new THREE.Euler(0, 0, 0, 'YXZ');
  let stepDist = 0, lastX = 0, lastZ = 0, warnT = 0, hbT = 0, partnerStep = 0;
  const prevFrame = w.hooks.frame;
  w.hooks.frame = (dt, g) => {
    prevFrame?.(dt, g);
    const cam = g.camera, t = w.t, p = g.player;
    camP.copy(cam.position);
    // torches for the caustic shader
    if (H.torch) { tP[0].copy(H.torch.position); tD[0].copy(H.torch.target.position).sub(H.torch.position).normalize(); }
    const P = c.partner;
    const pOn = !!(P && P.has && !P.dead);
    if (pOn) { ev.set(P.pitch || 0, P.yaw || 0, 0, 'YXZ'); qv.setFromEuler(ev); tD[1].set(0, 0, -1).applyQuaternion(qv); tP[1].set(P.sx, P.sy + 1.35, P.sz); }
    for (const W of HY.waters) {
      W.mesh.position.y = W.y; W.foam.position.y = W.y + 0.006;
      W.normal.offset.x = (t * 0.012) % 1; W.normal.offset.y = (t * 0.0075) % 1; W.foamT.offset.x = (-t * 0.01) % 1; W.foamT.offset.y = (t * 0.006) % 1;
      W.uni.uTime.value = t; W.uni.uSurf.value = W.y; W.uni.uOn.value[0] = H.torchOn ? Math.min(1, H.torchK) : 0; W.uni.uOn.value[1] = pOn ? 1 : 0;
      const F = W.flecks;
      for (let i = 0; i < F.seeds.length; i++) {
        const s = F.seeds[i]; s.x += s.vx * dt; s.z += s.vz * dt;
        if (s.x < W.x0 + 0.2 || s.x > W.x1 - 0.2) s.vx *= -1; if (s.z < W.z0 + 0.2 || s.z > W.z1 - 0.2) s.vz *= -1;
        F.pos[i * 3] = s.x; F.pos[i * 3 + 1] = W.y + 0.025 + Math.sin(t * 1.3 + s.p) * 0.015; F.pos[i * 3 + 2] = s.z;
      }
      F.pts.geometry.attributes.position.needsUpdate = true;
    }
    for (const r of rings) { if (r.t >= r.life) { r.m.visible = false; continue; } r.t += dt; const k = r.t / r.life; r.m.scale.setScalar(0.12 + k * r.size * 1.1); r.m.material.opacity = 0.5 * (1 - k) * (1 - k); }
    // drips
    for (const d of HY.drips) {
      d.next -= dt; if (d.next > 0) continue; d.next = d.every * (0.6 + Math.random() * 0.8);
      const dx = d.x - cam.position.x, dz = d.z - cam.position.z; if (dx * dx + dz * dz > 22 * 22) continue;
      const dr = drops[dropI++ % drops.length]; const W = HY.waterAt(d.x, d.z, d.y - 2);
      dr.on = true; dr.x = d.x; dr.z = d.z; dr.vy = 0; dr.fl = W ? W.y : (d.floor ?? 0); dr.m.position.set(d.x, d.y, d.z); dr.m.visible = true; dr.W = W;
    }
    for (const dr of drops) {
      if (!dr.on) continue; dr.vy -= 9 * dt; dr.m.position.y += dr.vy * dt;
      if (dr.m.position.y <= dr.fl) { dr.on = false; dr.m.visible = false; HY.ring(dr.x, dr.fl, dr.z, 0.5, 1.2); const dx = dr.x - cam.position.x, dz = dr.z - cam.position.z, dd = Math.hypot(dx, dz); if (dd < 16) S.drip(clamp(Math.sin(Math.atan2(dx, -dz) - g.yaw) * 0.8, -1, 1)); }
    }
    // wading: ripples and splashes around my feet and my partner's; deeper = louder
    const f = { W: HY.W, d: HY.depth };
    if (f.W && f.d > 0.05 && p.grounded) {
      const sp = Math.hypot(p.vx, p.vz); stepDist += Math.hypot(p.x - lastX, p.z - lastZ);
      if (stepDist > 1.5 / (1 + f.d * 0.3) && sp > 1) { stepDist = 0; sfx.splash(0.05 + Math.min(f.d, 1.6) * 0.04, 0, f.d); HY.ring(p.x, f.W.y, p.z, 1 + f.d * 0.5, 1.8); }
    }
    lastX = p.x; lastZ = p.z;
    if (pOn) {
      const PW = HY.waterAt(P.sx, P.sz, P.sy), pd = PW ? PW.y - P.sy : -9;
      if (pd > 0.05 && Math.hypot(P.vx || 0, P.vz || 0) > 1) { partnerStep += dt; if (partnerStep > 0.5) { partnerStep = 0; HY.ring(P.sx, PW.y, P.sz, 1 + pd * 0.5, 1.8); const dd = Math.hypot(P.sx - p.x, P.sz - p.z); if (dd < 14) sfx.splash(0.04 * (1 - dd / 14), clamp(Math.sin(Math.atan2(P.sx - p.x, -(P.sz - p.z)) - g.yaw), -1, 1) * 0.8, pd); } }
    }
    // underwater look
    const cw = HY.waterAt(cam.position.x, cam.position.z, cam.position.y);
    const underT = cw && cam.position.y < cw.y ? 1 : 0;
    HY.under += (underT - HY.under) * Math.min(1, dt * 9);
    fog.color.lerpColors(fogBase.color, fogUnder, HY.under); fog.density = lerp(fogBase.density, 0.19, HY.under);
    bubbles.visible = HY.under > 0.4;
    if (bubbles.visible) for (let i = 0; i < 40; i++) { let y = bubPos[i * 3 + 1] + bubV[i] * dt; if (y > cam.position.y + 2.4 || y === 0) { bubPos[i * 3] = cam.position.x + (Math.random() - 0.5) * 3; bubPos[i * 3 + 2] = cam.position.z + (Math.random() - 0.5) * 3; y = cam.position.y - 1.2 + Math.random() * 0.6; } bubPos[i * 3 + 1] = y; bubbles.geometry.attributes.position.needsUpdate = true; }
    g.fx.tint = HY.under > 0.5 ? [0.7, 1.0, 0.92] : [0.86, 1, 0.94];
    if (HY.under > 0.5) g.fx.desat = Math.max(g.fx.desat, 0.35);
    // air bar and warnings
    const low = HY.submerged || HY.air < 2.99;
    hud.style.opacity = low && g.state === 'playing' ? '1' : '0';
    if (low) { const k = HY.air / 3; airB.style.width = (k * 100).toFixed(0) + '%'; airB.style.background = k > 0.6 ? '#d6c04a' : '#d83a3a'; airT.textContent = HY.submerged ? (k < 0.4 ? 'GET OUT OF THE WATER' : 'HOLD ON') : 'BREATHE'; g.fx.damage = HY.submerged ? Math.max(g.fx.damage * 0.9, (1 - k) * 0.7) : g.fx.damage * 0.92; hbT -= dt; if (HY.submerged && hbT <= 0) { hbT = 0.4 + k * 0.5; S.beat(0.55 + (1 - k) * 0.5); if (Math.random() < 0.5) sfx.bubble(); } if (HY.submerged && !HY._was) sfx.gasp(); }
    else if (g.fx.damage > 0.001 && !HY.submerged) g.fx.damage *= 0.9;
    HY._was = HY.submerged;
    // underwater bed / water gurgle
    if (!bed && A.ctx) startBed();
    if (bed) { const target = 0.02 + HY.under * 0.28 + (HY.depth > 0.3 ? 0.025 : 0); bed.g.gain.setTargetAtTime(target, A.ctx.currentTime, 0.15); bed.fl.frequency.setTargetAtTime(HY.under > 0.5 ? 180 : 420, A.ctx.currentTime, 0.2); }
    warnT -= dt;
  };

  // ---- gauges and beacons: the tide, telegraphed ---------------------------------------------------------------------------------
  const gaugeTex = (hgt, lethal, floorLabel = '') => {
    const ppm = 150, cv = document.createElement('canvas'); cv.width = 110; cv.height = Math.round(hgt * ppm); const g = cv.getContext('2d');
    g.fillStyle = 'rgba(6,12,12,0.92)'; g.fillRect(0, 0, cv.width, cv.height);
    const Y = (m) => cv.height - m * ppm;
    g.fillStyle = 'rgba(150,26,26,0.9)'; g.fillRect(0, 0, cv.width, Y(lethal));
    g.strokeStyle = 'rgba(8,8,8,0.8)'; g.lineWidth = 7; for (let k = -cv.height; k < cv.height * 2; k += 22) { g.beginPath(); g.moveTo(0, Y(lethal) + k); g.lineTo(cv.width, Y(lethal) + k - 40); g.stroke(); }
    g.strokeStyle = '#cfe4de'; g.fillStyle = '#cfe4de'; g.font = '700 21px Impact, sans-serif'; g.textAlign = 'right';
    for (let m = 0; m <= hgt + 0.001; m += 0.25) { const y = Y(m), major = Math.abs(m * 2 - Math.round(m * 2)) < 0.01; g.lineWidth = major ? 3 : 1.5; g.beginPath(); g.moveTo(cv.width, y); g.lineTo(cv.width - (major ? 38 : 20), y); g.stroke(); if (major && m > 0) g.fillText(m.toFixed(1), cv.width - 44, y + 7); }
    g.save(); g.translate(26, Y(lethal) / 2); g.rotate(-Math.PI / 2); g.fillStyle = '#ffe9e0'; g.font = '700 20px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('NO AIR', 0, 0); g.restore();
    g.fillStyle = '#9db'; g.font = '700 14px Impact'; g.textAlign = 'left'; g.fillText(floorLabel, 4, cv.height - 6);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  };
  /** A painted depth gauge with a glowing waterline needle. (x, z) = wall face point; rot = yaw of the plate normal (0 faces +z). */
  HY.gauge = ({ x, z, rot = 0, floorY = 0, h = 3, lethal = 1.7, water, off = 0.04 }) => {
    const g = new THREE.Group(); g.position.set(x + Math.sin(rot) * off, floorY, z + Math.cos(rot) * off); g.rotation.y = rot; w.add(g);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.44, h), new THREE.MeshBasicMaterial({ map: gaugeTex(h, lethal), color: new THREE.Color(0.62, 0.7, 0.68), toneMapped: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 })); plate.position.y = h / 2; g.add(plate);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.5, 1.4), toneMapped: false })); line.position.z = 0.01; g.add(line);
    const tri = new THREE.Mesh(new THREE.CircleGeometry(0.07, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.9, 0.4), toneMapped: false })); tri.position.set(-0.3, 0, 0.012); g.add(tri);
    w.updaters.push(() => { const y = clamp(water.y - floorY, 0, h); line.position.y = y; tri.position.y = y; });
    return g;
  };
  /** A tide beacon: slow amber idle, a hard red pulse while the water's `warn` flag is up. */
  HY.beacon = ({ x, y, z, water }) => {
    const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0x20262a, roughness: 0.5, metalness: 0.8 })); g.add(housing);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3a20).multiplyScalar(2), toneMapped: false });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mat); bulb.position.y = 0.12; g.add(bulb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xff4a28, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.position.y = 0.12; halo.scale.setScalar(1.6); g.add(halo);
    let live = 0;
    w.updaters.push(() => { const warn = water.warn; const k = warn ? 0.5 + 0.5 * Math.sin(w.t * 9) : 0.12; live += (warn - live) * 0.2; mat.color.setRGB(2 * k + 0.1, 0.25 * k + 0.1, 0.1).multiplyScalar(1); halo.material.opacity = 0.18 + 0.6 * k; halo.scale.setScalar(1.0 + 1.2 * k); });
    return g;
  };

  // ---- hold-stations and two-handed valves ----------------------------------------------------------------------------------------------
  const label = (text, wd = 1.6, color = '#ffd9a0') => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d'); g.font = '700 54px Impact, sans-serif'; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 64);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(wd, wd / 4), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, color: 0xaa9a80, toneMapped: false }));
  };
  /** A wheel on a stub pipe and a floor plate. Standing on the plate counts as holding it. rot: yaw of the standing player's facing toward the wheel. */
  HY.station = ({ x, y = 0, z, text = 'HOLD', rot = 0, color = 0xffb040, wallDir = 1 }) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
    const dark = new THREE.MeshStandardMaterial({ color: 0x1f2528, roughness: 0.5, metalness: 0.85 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 10), horrorSurface('rust', { roughness: 0.55, metalness: 0.8 })); post.position.set(0, 0.55, -0.85 * wallDir); post.castShadow = true; g.add(post);
    const wheel = new THREE.Group(); wheel.position.set(0, 1.12, -0.7 * wallDir); g.add(wheel);
    const rimM = new THREE.MeshStandardMaterial({ color: 0x6a2a20, roughness: 0.5, metalness: 0.7, emissive: 0x200800, emissiveIntensity: 0.5 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 28), rimM); wheel.add(rim);
    for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.03, 0.03), dark); sp.rotation.z = (i * Math.PI) / 4; wheel.add(sp); }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 1.3), horrorSurface('rust', { roughness: 0.55, metalness: 0.8 })); plate.position.y = y === 0 ? 0.03 : 0.03; plate.receiveShadow = true; g.add(plate);
    const padM = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.9), toneMapped: false }); const ringPad = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 32), padM); ringPad.rotation.x = Math.PI / 2; ringPad.position.y = 0.065; g.add(ringPad);
    const barBg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.04), dark); barBg.position.set(0, 1.78, -0.85 * wallDir); g.add(barBg);
    const barM = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), toneMapped: false });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.06, 0.05), barM); bar.position.set(-0.58, 1.78, -0.83 * wallDir); bar.scale.x = 0.001; g.add(bar);
    const lb = label(text); lb.position.set(0, 2.05, -0.85 * wallDir); lb.rotation.y = wallDir > 0 ? 0 : Math.PI; g.add(lb);
    const zone = c.zone({ x, y: y + 1.05, z, w: 1.5, h: 2.1, d: 1.5, need: 'any' });
    const S_ = { group: g, zone, wheel, padM, barM, bar, color };
    S_.setProg = (k) => { bar.scale.x = Math.max(0.001, k); bar.position.x = -0.58 + 0.58 * k; };
    return S_;
  };
  /** Two stations that must both be occupied (by the two of you) to turn one valve for `secs`; progress sags when you let go. */
  HY.valve = ({ id, secs = 10, a, b, onDone, hint }) => {
    const A_ = HY.station(a), B_ = HY.station(b), V = { id, prog: 0, done: false, A: A_, B: B_, secs };
    let groanT = 0, hintT = 0;
    const finish = () => { if (V.done) return; V.done = true; V.prog = secs; for (const s of [A_, B_]) { s.padM.color.setRGB(0.3, 1.6, 0.7); s.barM.color.setRGB(0.3, 1.6, 0.7); s.setProg(1); } onDone?.(); };
    c.on('v:' + id, (v) => { if (v) finish(); });
    w.updaters.push((dt) => {
      if (V.done) return;
      const one = A_.zone.active || B_.zone.active, both = A_.zone.active && B_.zone.active;
      V.both = both;
      if (both) V.prog = Math.min(secs, V.prog + dt); else V.prog = Math.max(0, V.prog - dt * 0.55);
      const spin = both ? 3.4 : one ? 0.25 : 0;
      for (const s of [A_, B_]) { s.wheel.rotation.z += dt * spin * (s === A_ ? 1 : -1); s.setProg(V.prog / secs); s.padM.color.setHex(s.color).multiplyScalar(s.zone.active ? 1.7 : 0.8); }
      if (both) { groanT -= dt; if (groanT <= 0) { groanT = 2.2; S.groan(0.07); } }
      if (one && !both && game.state === 'playing') { hintT += dt; if (hintT > 3.5 && (A_.zone.mine || B_.zone.mine)) { hintT = -30; c.tell(me, hint || 'lt.c4.valve.one', { priority: 1 }); } } else if (!one) hintT = Math.min(0, hintT);
      if (V.prog >= secs) c.set('v:' + id, true);
    });
    return V;
  };

  return HY;
}

// ---------------------------------------------------------------- building blocks -----------------------------------------------------
/** Stairs climbing/descending from (x, z) along dir ('+x' '-x' '+z' '-z') from top-height y0 to y1. Walkable (auto-step). Returns the far end. */
export function stairs(w, { x, z, dir = '-z', y0 = 0, y1 = 2.4, width = 2, step = 0.4, run = 0.62, kind = 'concrete', color = 0x9aa09a, base }) {
  const n = Math.max(1, Math.round(Math.abs(y1 - y0) / step)), dy = (y1 - y0) / n, bot = base ?? Math.min(y0, y1) - 1.2;
  const ax = dir[1] === 'x' ? (dir[0] === '+' ? 1 : -1) : 0, az = dir[1] === 'z' ? (dir[0] === '+' ? 1 : -1) : 0;
  for (let i = 0; i < n; i++) {
    const top = y0 + dy * (i + 1), cx = x + ax * (i + 0.5) * run, cz = z + az * (i + 0.5) * run;
    hp(w, { x: cx, z: cz, y: top, w: ax ? run : width, d: az ? run : width, h: top - bot, kind, color, rough: 0.9, bump: 1.4, path: false });
  }
  return { x: x + ax * n * run, z: z + az * n * run, y: y1, n };
}
/** A solid slab whose TOP is y. */
export const slab = (w, { x, z, y, w: ww, d, h = 0.5, kind = 'concrete', color = 0x8e968f }) => hp(w, { x, z, y, w: ww, d, h, kind, color, rough: 0.9, bump: 1.4, path: false });
/** Hydro-tub bench / ledge decoration: a wooden slatted bench (solid). */
export function bench(w, { x, z, rot = 0, len = 2.2 }) {
  const along = Math.abs(Math.cos(rot)) > 0.7;
  box(w, { x, y: 0.46, z, w: along ? len : 0.5, h: 0.07, d: along ? 0.5 : len, kind: 'wood' });
  for (const s of [-1, 1]) box(w, { x: x + (along ? s * (len / 2 - 0.15) : 0), y: 0.23, z: z + (along ? 0 : s * (len / 2 - 0.15)), w: 0.07, h: 0.46, d: 0.45, kind: 'rust', color: 0x55605c });
  w.collider({ x, y: 0.25, z, w: along ? len : 0.5, h: 0.5, d: along ? 0.5 : len });
}
/** A continuous-bath tub: enamel sides, dark water, a canvas sheet with a head hole, leather straps. */
export function tub(w, { x, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  const enamel = new THREE.MeshStandardMaterial({ color: 0xa9b0a8, roughness: 0.3, metalness: 0.15 });
  const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(0.1, 0.8, 2.2), enamel, -0.5, 0.4, 0); add(new THREE.BoxGeometry(0.1, 0.8, 2.2), enamel, 0.5, 0.4, 0); add(new THREE.BoxGeometry(1.1, 0.8, 0.1), enamel, 0, 0.4, -1.05); add(new THREE.BoxGeometry(1.1, 0.8, 0.1), enamel, 0, 0.4, 1.05); add(new THREE.BoxGeometry(1.0, 0.1, 2.0), enamel, 0, 0.08, 0);
  add(new THREE.PlaneGeometry(0.92, 1.96), new THREE.MeshStandardMaterial({ color: 0x050d0d, roughness: 0.05, metalness: 0.7 }), 0, 0.62, 0).rotation.x = -Math.PI / 2;
  const sheet = add(new THREE.BoxGeometry(1.06, 0.03, 1.4), new THREE.MeshStandardMaterial({ color: 0x8a8670, roughness: 1 }), 0, 0.84, 0.25);
  const hole = add(new THREE.TorusGeometry(0.17, 0.04, 6, 16), new THREE.MeshStandardMaterial({ color: 0x2b1d16, roughness: 0.7 }), 0, 0.86, -0.62); hole.rotation.x = Math.PI / 2;
  for (const pz of [-0.1, 0.5]) add(new THREE.BoxGeometry(1.14, 0.045, 0.1), new THREE.MeshStandardMaterial({ color: 0x2b1d16, roughness: 0.6 }), 0, 0.87, pz);
  void sheet;
  const along = Math.abs(Math.cos(rot)) < 0.7;
  w.collider({ x, y: 0.45, z, w: along ? 2.3 : 1.2, h: 0.9, d: along ? 1.2 : 2.3 });
}
/** A lifebuoy on a wall. */
export function lifebuoy(w, { x, y = 1.8, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 10, 24), new THREE.MeshStandardMaterial({ color: 0x8a2a24, roughness: 0.8 })); g.add(t);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xcfc9b8, roughness: 0.9 })); b.position.set(Math.cos(i * 1.571) * 0.3, Math.sin(i * 1.571) * 0.3, 0); b.rotation.z = i * 1.571; g.add(b); }
  return g;
}
/** A painted notice board (plain text lines). */
export function board(w, { x, y = 1.8, z, rot = 0, width = 2.2, lines, title, glow = 0.55 }) {
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 400; const g = cv.getContext('2d');
  g.fillStyle = '#262c2a'; g.fillRect(0, 0, 640, 400); g.strokeStyle = '#8aa098'; g.lineWidth = 6; g.strokeRect(10, 10, 620, 380);
  g.fillStyle = '#d6e4de'; g.font = '700 46px Impact, sans-serif'; g.textAlign = 'center'; g.fillText(title, 320, 74);
  g.font = '700 34px "Courier New", monospace'; g.textAlign = 'left'; lines.forEach((l, i) => { g.fillStyle = l.startsWith('!') ? '#e86a5a' : '#b9cbc4'; g.fillText(l.replace(/^!/, ''), 40, 140 + i * 50); });
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.4})`; g.fillRect(Math.random() * 640, Math.random() * 400, 2 + Math.random() * 10, 1 + Math.random() * 3); }
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.625), new THREE.MeshBasicMaterial({ map: tx, color: new THREE.Color(glow, glow, glow), toneMapped: false }));
  m.position.set(x, y, z); m.rotation.y = rot; w.add(m); return m;
}
/** A number painted on a locker door. */
export function numTag(w, { x, y = 1.55, z, rot = 0, text }) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = 'rgba(210,216,200,0.8)'; g.font = '700 84px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 68);
  for (let i = 0; i < 60; i++) { g.clearRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 8, 1 + Math.random() * 2); }
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, color: 0x8c948c, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  m.position.set(x, y, z); m.rotation.y = rot; w.add(m); return m;
}
/** A hanging bell with a rope: pull it to make a noise (returns the interactable). */
export function bell(w, { x, y = 1.8, z, onRing, label = 'Ring the bell' }) {
  const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
  const brass = new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.35, metalness: 0.85 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), brass); b.rotation.x = Math.PI; b.position.y = -0.05; g.add(b);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 5), new THREE.MeshStandardMaterial({ color: 0x4a4030, roughness: 1 })); rope.position.y = -0.7; g.add(rope);
  let swing = 0;
  const it = w.interactable({ x, y: y - 0.7, z, w: 0.7, h: 1.2, d: 0.7, range: 3.2, label, onUse: () => onRing?.() });
  g.userData.ring = () => { swing = 1; };
  w.updaters.push((dt) => { swing = Math.max(0, swing - dt * 0.45); g.rotation.z = Math.sin(w.t * 11) * swing * 0.35; });
  void it; return g;
}
/** A slow-bobbing piece of flotsam that rides on a water's surface. */
export function floater(w, water, mesh, { x, z, bob = 0.035, drift = 0.03, lo = 0, ph = Math.random() * 6 }) {
  mesh.position.x = x; mesh.position.z = z; w.add(mesh);
  w.updaters.push(() => { mesh.position.y = water.y + lo + Math.sin(w.t * 0.9 + ph) * bob; mesh.rotation.y += 0.0008 * (1 + ph % 1); mesh.position.x = x + Math.sin(w.t * 0.13 + ph) * drift * 6; });
  return mesh;
}
