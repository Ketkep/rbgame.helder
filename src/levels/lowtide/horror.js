import * as THREE from 'three';
import { softTexture } from '../../engine/materials.js';
import { horrorSound } from './sound.js';

// Lowtide's look: a near-black world lit by your torch (a real shadow-casting spotlight), a handful of flickering ward lamps (a small pool of
// real point lights that follow whichever lamps are nearest, so the light count never changes), dense exponential fog, a volumetric torch cone
// you can see in the air (yours faintly, your partner's clearly) and dust that catches the beam. The grain/vignette/aberration screen pass is in post.js.

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const BEAM_VERT = `varying vec3 vN; varying vec3 vV; varying float vT;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vT = clamp(-position.z, 0.0, 1.0); gl_Position = projectionMatrix * mv; }`;
const BEAM_FRAG = `uniform vec3 uColor; uniform float uInt; varying vec3 vN; varying vec3 vV; varying float vT;
void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float fall = pow(1.0 - vT, 1.4) * smoothstep(0.0, 0.06, vT); gl_FragColor = vec4(uColor * (uInt * f * fall), 1.0); }`;
function beamMaterial(color, int) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uInt: { value: int } },
    vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
}

/** A cone with its apex at the origin opening toward -Z (length 1, base radius 1). */
function beamGeometry() { const g = new THREE.ConeGeometry(1, 1, 28, 1, true); g.translate(0, -0.5, 0); g.rotateX(-Math.PI / 2); return g; }

export function horrorEnv(w, game, o = {}) {
  const low = !!game.lowGfx;
  w.env({
    top: 0x03060a, horizon: 0x070c10, bottom: 0x010203,
    fog: { color: o.fogColor ?? 0x05090c, near: 4, far: 60 },
    sun: { color: 0x6a8aa0, intensity: 0, dir: [-0.3, 0.8, 0.4], shadow: false },
    hemi: { sky: o.ambientSky ?? 0x33505e, ground: 0x0b0e10, intensity: o.ambient ?? 0.55 },
    exposure: o.exposure ?? 1.35, stars: 0, clouds: null,
    bloom: { strength: o.bloom ?? 0.9, radius: 0.85, threshold: 0.58 },
    motes: { color: 0xb8ccd6, count: low ? 100 : 240, size: 0.022, opacity: 0.4 },
    envMap: { top: 0x1c2a34, mid: 0x0a1014, bottom: 0x040506, intensity: 0.45, lights: [{ pos: [0, 9, 0], w: 8, h: 4, color: 0xcfeee0, intensity: 2.4 }, { pos: [-9, 3, 4], w: 3, h: 6, color: 0x7ec4b0, intensity: 1.4 }] },
  });
  w.scene.fog = new THREE.FogExp2(o.fogColor ?? 0x05090c, o.density ?? 0.062);
  w.scene.background = new THREE.Color(0x020406);
  w.setTheme({ tex: 'tile', color: 0xffffff, trim: null, edge: null, edgeOpacity: 0, accent: 0xc8d8d0, danger: 0xb01824, roughness: 0.9 });
  w.killY = -60;
  w.horror = true;

  const H = { torchK: 1, torchOn: true, lamps: [], dimT: 0, mood: o.mood || 'calm' };
  const S = (H.S = horrorSound(game));
  w.disposers.push(() => S.stop());
  w.coop?.setAvatarStyle?.('horror');

  // ---- the torch --------------------------------------------------------------------------------------------------------
  const ANGLE = 0.5;
  const torch = new THREE.SpotLight(0xfff1dc, 72, 46, ANGLE, 0.85, 1.5);
  torch.castShadow = !low;
  torch.shadow.mapSize.set(1024, 1024); torch.shadow.camera.near = 0.25; torch.shadow.camera.far = 46; torch.shadow.bias = -0.0005; torch.shadow.normalBias = 0.035;
  w.add(torch); w.add(torch.target);
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), new THREE.MeshBasicMaterial({ visible: false }));      // keeps the light "used" when culled
  w.add(lens);
  const myBeam = new THREE.Mesh(beamGeometry(), beamMaterial(0xfff0d8, 0.05)); myBeam.frustumCulled = false; myBeam.scale.set(7, 7, 14); w.add(myBeam);
  const theirBeam = new THREE.Mesh(beamGeometry(), beamMaterial(0xdff4ff, 0.2)); theirBeam.frustumCulled = false; theirBeam.scale.set(6.5, 6.5, 13); theirBeam.visible = false; w.add(theirBeam);
  const theirLight = new THREE.SpotLight(0xdff4ff, 90, 34, ANGLE, 0.8, 1.6); theirLight.castShadow = false; w.add(theirLight); w.add(theirLight.target); theirLight.visible = false;
  const theirGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xcfeaff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  theirGlow.scale.setScalar(0.9); theirGlow.visible = false; w.add(theirGlow);
  H.torch = torch;

  // ---- ward lamps -------------------------------------------------------------------------------------------------------
  const POOL = low ? 3 : 5;
  const pool = Array.from({ length: POOL }, () => { const l = new THREE.PointLight(0xdfffe6, 0, 17, 1.7); l.castShadow = false; w.add(l); return l; });
  const tubeGeo = new THREE.BoxGeometry(1, 0.07, 0.16), houseGeo = new THREE.BoxGeometry(1.1, 0.1, 0.26), shaftGeo = beamGeometry();
  const houseMat = new THREE.MeshStandardMaterial({ color: 0x1b2024, roughness: 0.6, metalness: 0.6 });
  let lampId = 0;
  /**
   * A ceiling light. mode: 'steady' | 'buzz' (nervous flicker) | 'dying' (mostly dim, bursts of light) | 'dead' | 'strobe'.
   * Flicker is a pure function of the world clock, so both players see the same thing.
   */
  H.lamp = ({ x, y, z, color = 0xdfffe6, power = 1, mode = 'buzz', len = 1.2, rot = 0, shaft = true }) => {
    const id = lampId++;
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
    const house = new THREE.Mesh(houseGeo, houseMat); house.scale.x = len; house.position.y = 0.03; g.add(house);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), toneMapped: false });
    const tube = new THREE.Mesh(tubeGeo, mat); tube.scale.x = len * 0.92; tube.position.y = -0.03; g.add(tube);
    let sh = null;
    if (shaft) { sh = new THREE.Mesh(shaftGeo, beamMaterial(color, 0.07)); sh.rotation.set(-Math.PI / 2, 0, 0); sh.scale.set(1.7, 1.7, 4.4); sh.position.set(0, -0.05, 0); sh.frustumCulled = false; g.add(sh); }
    const L = { id, x, y: y - 0.3, z, color, power, mode, mat, base: new THREE.Color(color).multiplyScalar(2.2), shaft: sh, k: 1, forced: null };
    H.lamps.push(L);
    return L;
  };
  const flick = (L, t) => {
    if (L.forced !== null) return L.forced;
    const s = Math.floor(t * 9) + L.id * 31;
    switch (L.mode) {
      case 'steady': return 1;
      case 'dead': return hash(Math.floor(t * 14) + L.id) > 0.992 ? 0.5 : 0;
      case 'strobe': return Math.floor(t * 6 + L.id) % 2 ? 1 : 0.04;
      case 'dying': { const r = hash(s); return r > 0.82 ? 1 : r > 0.55 ? 0.22 : 0.05 + 0.06 * Math.sin(t * 40 + L.id); }
      default: { const r = hash(s); return r > 0.93 ? 0.15 : 0.82 + 0.18 * Math.sin(t * 55 + L.id * 3); }
    }
  };

  // ---- per-frame --------------------------------------------------------------------------------------------------------
  const fwd = new THREE.Vector3(), tmp = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ');
  const prev = w.hooks.frame;
  w.hooks.frame = (dt, g) => {
    prev?.(dt, g);
    const t = w.t, cam = g.camera;
    if (!S.ok && g.audio.ctx) S.start();
    S.update(dt, t);
    H.dimT = Math.max(0, H.dimT - dt);
    // torch: attached to the camera, a little low and to the right like a hand-held light
    const k = (H.torchOn ? 1 : 0) * H.torchK * (H.dimT > 0 ? 0.25 + 0.75 * hash(Math.floor(t * 20)) : 1) * (0.97 + 0.03 * Math.sin(t * 23));
    fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
    tmp.set(0.22, -0.2, -0.1).applyQuaternion(cam.quaternion).add(cam.position);
    torch.position.copy(tmp); torch.target.position.copy(tmp).addScaledVector(fwd, 10); torch.intensity = 72 * k;
    myBeam.position.copy(tmp); myBeam.quaternion.copy(cam.quaternion); myBeam.visible = k > 0.05; myBeam.material.uniforms.uInt.value = 0.05 * k;
    // partner's torch
    const c = w.coop, P = c?.partner;
    const on = !!(P && P.has && !P.dead && H.theirOn !== false);
    theirBeam.visible = theirLight.visible = theirGlow.visible = on;
    if (on) {
      e.set(P.pitch || 0, P.yaw || 0, 0, 'YXZ'); q.setFromEuler(e);
      fwd.set(0, 0, -1).applyQuaternion(q);
      tmp.set(0.22, 1.35, -0.1).applyQuaternion(q).add(V3.set(P.sx, P.sy, P.sz));
      theirBeam.position.copy(tmp); theirBeam.quaternion.copy(q);
      theirLight.position.copy(tmp); theirLight.target.position.copy(tmp).addScaledVector(fwd, 10);
      theirGlow.position.copy(tmp);
    }
    // lamps
    let n = 0; const cp = cam.position;
    for (const L of H.lamps) {
      L.k = flick(L, t);
      L.mat.color.copy(L.base).multiplyScalar(L.k);
      if (L.shaft) L.shaft.material.uniforms.uInt.value = 0.075 * L.k;
      L.d2 = (L.x - cp.x) ** 2 + (L.y - cp.y) ** 2 + (L.z - cp.z) ** 2;
    }
    const live = H.lamps.filter((L) => L.k > 0.03 && L.d2 < 28 * 28).sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < POOL; i++) {
      const L = live[i], pl = pool[i];
      if (!L) { pl.intensity = 0; continue; }
      pl.position.set(L.x, L.y, L.z); pl.color.setHex(L.color); pl.intensity = 22 * L.k * L.power; n++;
    }
    void n; void lens;
  };
  const V3 = new THREE.Vector3();

  /** A torch beam + glow with NO real light behind it (the doppelganger's torch: it never lights the wall it points at). Returns { set(x, y, z, yaw, pitch, on), hide() }. */
  H.ghostTorch = () => {
    const beam = new THREE.Mesh(beamGeometry(), beamMaterial(0xdff4ff, 0.2)); beam.frustumCulled = false; beam.scale.set(6.5, 6.5, 13); beam.visible = false; w.add(beam);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xcfeaff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    glow.scale.setScalar(0.9); glow.visible = false; w.add(glow);
    const qq = new THREE.Quaternion(), ee = new THREE.Euler(0, 0, 0, 'YXZ'), vv = new THREE.Vector3();
    return {
      set(x, y, z, yaw, pitch, on = true) {
        beam.visible = glow.visible = on; if (!on) return;
        ee.set(pitch || 0, yaw || 0, 0, 'YXZ'); qq.setFromEuler(ee);
        vv.set(0.22, 1.35, -0.1).applyQuaternion(qq).add(V3.set(x, y, z));
        beam.position.copy(vv); beam.quaternion.copy(qq); glow.position.copy(vv);
      },
      hide() { beam.visible = glow.visible = false; },
    };
  };
  /** Brief torch stutter (a scare beat). */
  H.stutter = (sec = 1.2) => { H.dimT = Math.max(H.dimT, sec); };
  /** Switch every lamp to one mode, or force them all to a brightness for a while (null releases them). */
  H.allLamps = (mode) => { for (const L of H.lamps) L.mode = mode; };
  H.force = (k) => { for (const L of H.lamps) L.forced = k; };
  w.H = H;
  return H;
}
