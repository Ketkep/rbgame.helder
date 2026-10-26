import * as THREE from 'three';
import { softTexture } from '../../engine/materials.js';
import { horrorSurface } from './materials.js';
import { box } from './kit.js';
import { figure } from './figure.js';

// Pieces for chapter 6 (The Morgue): steel drawer banks with sliding trays and sheeted bodies, a two-sided handshake console, speech tags, stone
// angels, a rain field, lamp posts, gravestones and hedges. Faces +z at rot 0 unless stated. Everything solid goes through w.collider.

const glow = (hex, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });
const M = {
  steel: () => new THREE.MeshStandardMaterial({ color: 0x8e9996, roughness: 0.42, metalness: 0.85 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x1b2024, roughness: 0.55, metalness: 0.7 }),
  tray: () => new THREE.MeshStandardMaterial({ color: 0xa9b3ae, roughness: 0.35, metalness: 0.9 }),
  sheet: () => new THREE.MeshStandardMaterial({ color: 0xaeb3a6, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
  stain: () => new THREE.MeshStandardMaterial({ color: 0x5a1a1a, roughness: 0.9 }),
  iron: () => new THREE.MeshStandardMaterial({ color: 0x15191b, roughness: 0.6, metalness: 0.8 }),
  wood: () => new THREE.MeshStandardMaterial({ color: 0x2e2218, roughness: 0.9 }),
  black: () => new THREE.MeshBasicMaterial({ color: 0x020304 }),
};
const memo = new Map();
export const mat = (k) => { if (!memo.has(k)) memo.set(k, M[k]()); return memo.get(k); };
const put = (parent, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
const rotXZ = (rot, lx, lz) => ({ x: lx * Math.cos(rot) + lz * Math.sin(rot), z: -lx * Math.sin(rot) + lz * Math.cos(rot) });   // local -> world offset for a y rotation

/** A sheeted body: long cloth hump with a head bump and (when `pivot` is used) a hip pivot so it can sit up. Length along local +z. */
export function sheetBody(len = 1.7, stained = false) {
  const g = new THREE.Group();
  const piv = new THREE.Group(); piv.position.set(0, 0.1, -0.03 * len); g.add(piv);                             // hip pivot (sits up around it)
  put(piv, new THREE.BoxGeometry(0.46, 0.2, len * 0.5), mat('sheet'), 0, 0.02, len * 0.27);
  put(piv, new THREE.SphereGeometry(0.14, 12, 10), mat('sheet'), 0, 0.1, len * 0.58).scale.set(0.9, 1, 1.1);
  put(g, new THREE.BoxGeometry(0.4, 0.14, len * 0.48), mat('sheet'), 0, 0.07, -len * 0.27);
  put(g, new THREE.BoxGeometry(0.28, 0.1, 0.18), mat('sheet'), 0, 0.17, -len * 0.5 + 0.1).rotation.x = -0.4;     // toes
  if (stained) { const s = put(piv, new THREE.BoxGeometry(0.2, 0.01, 0.3), mat('stain'), 0.06, 0.125, len * 0.3); s.rotation.y = 0.4; }
  return { group: g, pivot: piv };
}

/**
 * A bank of steel mortuary drawers (rows x cols), front face on the line (x, z) facing local +z (rot 0 = faces +z; PI/2 = faces +x; -PI/2 = faces -x).
 * Each drawer: { id, row, col, k (0..1 open), want, rate, sit (0..1 the body sits up), world {x, y, z}, out {x, z} }.
 */
export function drawerBank(w, { x, z, rot = 0, cols = 8, rows = 3, pitch = 1.1, id = (r, c) => `${'ABC'[r]}${c + 1}`, solid = true, height = 2.5 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  const W = cols * pitch + 0.3, rowH = (height - 0.2) / rows;
  const body = put(g, new THREE.BoxGeometry(W, height, 0.9), horrorSurface('rust', { color: 0x5b6864, roughness: 0.55, metalness: 0.7, bump: 1.6 }), 0, height / 2, -0.45);
  body.castShadow = false;
  const out = rotXZ(rot, 0, 1);
  const drawers = [];
  const cav = new THREE.PlaneGeometry(pitch - 0.1, rowH - 0.1);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const lx = -W / 2 + 0.15 + pitch * (c + 0.5), ly = 0.1 + rowH * (rows - 1 - r) + rowH / 2;     // row 0 = top (A)
    const cavity = new THREE.Mesh(cav, mat('black')); cavity.position.set(lx, ly, 0.004); g.add(cavity);
    const slide = new THREE.Group(); slide.position.set(lx, ly, 0); g.add(slide);
    put(slide, new THREE.BoxGeometry(pitch - 0.08, rowH - 0.08, 0.05), horrorSurface('rust', { color: 0x7d8a86, roughness: 0.45, metalness: 0.8, bump: 1.2 }), 0, 0, 0.025);
    put(slide, new THREE.BoxGeometry(0.34, 0.04, 0.06), mat('dark'), 0, 0.02, 0.075);
    put(slide, new THREE.BoxGeometry(0.2, 0.07, 0.01), mat('tray'), 0, rowH * 0.28, 0.055);
    const tray = put(slide, new THREE.BoxGeometry(pitch - 0.2, 0.05, 1.7), mat('tray'), 0, -rowH * 0.2, -0.85);
    void tray;
    const sb = sheetBody(1.5, (r * 7 + c * 3) % 5 === 0); sb.group.position.set(0, -rowH * 0.2 + 0.025, -0.9); slide.add(sb.group); sb.group.visible = false;
    const d = { id: id(r, c), row: r, col: c, k: 0, want: 0, rate: 1.4, sit: 0, sitWant: 0, slide, body: sb, rowH,
      world: { x: x + rotXZ(rot, lx, 0).x, y: ly, z: z + rotXZ(rot, lx, 0).z }, out };
    drawers.push(d);
  }
  const ext = 1.45;
  w.updaters.push((dt) => {
    for (const d of drawers) {
      if (d.k !== d.want) { d.k += Math.sign(d.want - d.k) * Math.min(Math.abs(d.want - d.k), dt * d.rate); }
      d.slide.position.z = d.k * ext;
      d.body.group.visible = d.k > 0.03;
      if (d.sit !== d.sitWant) d.sit += Math.sign(d.sitWant - d.sit) * Math.min(Math.abs(d.sitWant - d.sit), dt * 0.9);
      d.body.pivot.rotation.x = -d.sit * 1.2;
    }
  });
  if (solid) {
    const c0 = rotXZ(rot, 0, -0.45), sw = Math.abs(Math.cos(rot)) > 0.7;
    w.collider({ x: x + c0.x, y: height / 2, z: z + c0.z, w: sw ? W : 0.9, h: height, d: sw ? 0.9 : W });
  }
  return { group: g, drawers, W };
}

/** A two-sided handshake console: a palm plate on its south (+z) and north (-z) face and a status lamp on top. */
export function handConsole(w, { x, z, label = 'A' }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); w.add(g);
  put(g, new THREE.BoxGeometry(1.0, 0.95, 0.8), horrorSurface('rust', { color: 0x3c4742, roughness: 0.55, metalness: 0.75, bump: 1.5 }), 0, 0.475, 0);
  put(g, new THREE.BoxGeometry(1.08, 0.06, 0.88), mat('dark'), 0, 0.98, 0);
  put(g, new THREE.BoxGeometry(0.1, 1.5, 0.1), mat('dark'), 0, 0.75, 0);
  const pads = {};
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const cx = cv.getContext('2d');
  cx.fillStyle = '#000'; cx.fillRect(0, 0, 128, 128); cx.strokeStyle = '#fff'; cx.fillStyle = '#fff'; cx.lineWidth = 8; cx.lineCap = 'round';
  cx.beginPath(); cx.ellipse(64, 80, 26, 30, 0, 0, 7); cx.fill();
  for (const [ax, ay, bx, by] of [[40, 56, 30, 22], [54, 50, 52, 12], [68, 50, 72, 12], [82, 56, 92, 24], [38, 84, 18, 66]]) { cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(bx, by); cx.stroke(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  for (const [side, sz] of [['s', 1], ['n', -1]]) {
    const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0xffb040).multiplyScalar(0.7), toneMapped: false });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), m); p.rotation.x = -Math.PI / 2; p.rotation.z = sz > 0 ? 0 : Math.PI; p.position.set(0, 1.015, sz * 0.22); g.add(p);
    const rim = put(g, new THREE.BoxGeometry(0.5, 0.012, 0.5), mat('dark'), 0, 1.012, sz * 0.22);
    void rim;
    pads[side] = { mat: m, x, z: z + sz * 0.62, sz };
  }
  const lampM = glow(0xff3a2a, 1.6); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), lampM); lamp.position.set(0, 1.58, 0); g.add(lamp);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xff3a2a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.position.set(0, 1.58, 0); halo.scale.setScalar(0.9); g.add(halo);
  // a stencilled letter on each face
  const lc = document.createElement('canvas'); lc.width = 128; lc.height = 128; const lx = lc.getContext('2d'); lx.fillStyle = '#c9d3cc'; lx.font = '900 100px Impact, Arial Black, sans-serif'; lx.textAlign = 'center'; lx.textBaseline = 'middle'; lx.fillText(label, 64, 70);
  const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace;
  for (const sz of [1, -1]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: lt, transparent: true, opacity: 0.55, toneMapped: false })); l.position.set(0, 0.55, sz * 0.405); l.rotation.y = sz > 0 ? 0 : Math.PI; g.add(l); }
  w.collider({ x, y: 0.75, z, w: 1.0, h: 1.5, d: 0.8 });
  const C = { group: g, pads, x, z, state: 'idle' };
  C.set = (state) => {
    C.state = state;
    const col = state === 'ok' ? 0x3dff7a : state === 'wait' ? 0xffb040 : state === 'bad' ? 0xff3a2a : 0xff3a2a;
    lampM.color.copy(new THREE.Color(col).multiplyScalar(1.8)); halo.material.color.setHex(col);
    for (const p of Object.values(pads)) p.mat.color.copy(new THREE.Color(state === 'ok' ? 0x3dff7a : 0xffb040).multiplyScalar(state === 'idle' ? 0.7 : 1.6));
  };
  w.updaters.push(() => { halo.material.opacity = (C.state === 'ok' ? 0.5 : 0.35) + Math.sin(w.t * (C.state === 'wait' ? 9 : 2.4) + x) * 0.12; });
  C.set('idle');
  return C;
}

/** A word/statement tag that floats over a head: tag.set('MOTH', '#cfe') */
export function speechTag(parent, { y = 2.45, w: ww = 1.7, h: hh = 0.62 } = {}) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const cx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
  sp.scale.set(ww, hh, 1); sp.position.y = y; sp.renderOrder = 15; parent.add(sp);
  let cur = null;
  return {
    sprite: sp,
    set(text, color = '#cfe8dc') {
      if (cur === text + color) return; cur = text + color;
      cx.clearRect(0, 0, 256, 96); cx.fillStyle = 'rgba(4,8,8,0.72)'; cx.beginPath(); cx.roundRect(8, 12, 240, 72, 16); cx.fill();
      cx.strokeStyle = color; cx.globalAlpha = 0.5; cx.lineWidth = 2; cx.stroke(); cx.globalAlpha = 1;
      cx.fillStyle = color; cx.font = '800 44px "Courier New", monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(text, 128, 50);
      tex.needsUpdate = true;
    },
    show(v) { sp.visible = v; },
  };
}

/** A low stone plinth with a painted mark. Solid. */
export function plinth(w, { x, z, label = 'A', size = 1.4 }) {
  box(w, { x, y: 0.12, z, w: size, h: 0.24, d: size, kind: 'concrete', color: 0x6a746f });
  box(w, { x, y: 0.26, z, w: size - 0.3, h: 0.06, d: size - 0.3, kind: 'rust', color: 0x333b38, shadow: false });
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const cx = cv.getContext('2d');
  cx.fillStyle = '#c9d3cc'; cx.font = '900 90px Impact, Arial Black, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(label, 64, 70);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.298, z + size / 2 - 0.3); w.add(m);
}

/** Recolour a figure for a stone statue. */
export function stoneFigure(w, { x, z, y = 0, yaw = 0, scale = 1 }) {
  const F = figure(w, { kind: 'patient', scale });
  F.group.traverse((o) => { if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); const h = o.material.color.getHex(); o.material.color.setHex(h === 0x0a0b0c ? 0x1a1e1d : h === 0x4a0c10 ? 0x3a4440 : 0x59605c); o.material.roughness = 0.95; } });
  F.pose(0, 0, 0, 0); F.set(x, y, z); F.face(yaw);
  return F;
}

/** A stone angel on a pedestal: wings, praying hands, two eyes that glow with e.eyes(k). e.F is the figure; e.headPos is the world point to aim at. */
export function angel(w, { x, z, yaw = 0 }) {
  box(w, { x, y: 0.45, z, w: 1.3, h: 0.9, d: 1.3, kind: 'concrete', color: 0x66706a, rot: yaw });
  box(w, { x, y: 0.95, z, w: 1.6, h: 0.12, d: 1.6, kind: 'concrete', color: 0x59625d, rot: yaw });
  w.collider({ x, y: 0.5, z, w: 1.5, h: 1.0, d: 1.5 });
  const F = stoneFigure(w, { x, z, y: 1.01, yaw, scale: 1.05 });
  const wingM = new THREE.MeshStandardMaterial({ color: 0x4d5450, roughness: 0.95, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.8), wingM); wing.position.set(s * 0.5, 2.1, -0.35); wing.rotation.set(0.25, 0, s * 0.45); wing.castShadow = true; F.group.add(wing);
    const feather = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.55), wingM); feather.position.set(s * 0.82, 1.55, -0.4); feather.rotation.set(0.3, 0, s * 0.62); F.group.add(feather);
  }
  const eyeM = glow(0x7fd8ff, 0.0);
  const eyes = [-0.06, 0.06].map((sx) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), eyeM); e.position.set(sx, 0.1, 0.168); F.head.add(e); return e; });
  void eyes;
  const A = { F, x, z, head: new THREE.Vector3(x, 1.01 + 1.95, z), eyeM };
  A.eyes = (k) => { eyeM.color.copy(new THREE.Color(0x7fd8ff).multiplyScalar(k * 5)); };
  return A;
}

/** Falling rain around the camera. A LineSegments field, relocated each frame; k 0..1 sets how much. */
export function rainField(w, game, { count = 700, radius = 15, height = 9 } = {}) {
  const pos = new Float32Array(count * 6), seed = [];
  for (let i = 0; i < count; i++) seed.push({ x: (Math.random() * 2 - 1) * radius, z: (Math.random() * 2 - 1) * radius, y: Math.random() * height, v: 17 + Math.random() * 7 });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fb8c8, transparent: true, opacity: 0.0, depthWrite: false, fog: false }));
  m.frustumCulled = false; w.add(m);
  const R = { k: 0, mesh: m };
  const prev = w.hooks.frame;
  w.hooks.frame = (dt, g) => {
    prev?.(dt, g);
    m.visible = R.k > 0.02; if (!m.visible) return;
    m.material.opacity = 0.34 * R.k;
    const cam = g.camera.position, a = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const s = seed[i]; s.y -= s.v * dt; if (s.y < 0) { s.y += height; s.x = (Math.random() * 2 - 1) * radius; s.z = (Math.random() * 2 - 1) * radius; }
      const px = cam.x + s.x, pz = cam.z + s.z, py = s.y + Math.max(0, cam.y - 2);
      a[i * 6] = px; a[i * 6 + 1] = py; a[i * 6 + 2] = pz; a[i * 6 + 3] = px - 0.04; a[i * 6 + 4] = py + 0.55; a[i * 6 + 5] = pz;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return R;
}

/** An iron lamp post with a dim lantern (the light itself is an H.lamp so it joins the pool). */
export function lampPost(w, H, { x, z, mode = 'dying', color = 0xffd9a0, power = 0.9 }) {
  put(w.scene, new THREE.CylinderGeometry(0.05, 0.08, 3.1, 8), mat('iron'), x, 1.55, z);
  put(w.scene, new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10), mat('iron'), x, 0.04, z);
  const lan = new THREE.Group(); lan.position.set(x, 3.15, z); w.add(lan);
  put(lan, new THREE.BoxGeometry(0.34, 0.06, 0.34), mat('iron'), 0, 0.28, 0);
  put(lan, new THREE.BoxGeometry(0.34, 0.06, 0.34), mat('iron'), 0, -0.14, 0);
  for (const [px, pz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) put(lan, new THREE.BoxGeometry(0.025, 0.42, 0.025), mat('iron'), px, 0.07, pz);
  w.collider({ x, y: 1.5, z, w: 0.3, h: 3.0, d: 0.3 });
  return H.lamp({ x, y: 3.36, z, color, power, mode, len: 0.34, shaft: false });
}

/** A gravestone: slab + rounded top, with optional lines of text. */
export function grave(w, { x, z, rot = 0, h = 1.1, text = [], lean = 0, wide = 0.7, color = 0x5d6762 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.set(lean, rot, lean * 0.6); w.add(g);
  put(g, new THREE.BoxGeometry(wide, h, 0.16), horrorSurface('concrete', { color, roughness: 0.95, bump: 1.8 }), 0, h / 2, 0);
  const top = put(g, new THREE.CylinderGeometry(wide / 2, wide / 2, 0.16, 14, 1, false, 0, Math.PI), horrorSurface('concrete', { color, roughness: 0.95, bump: 1.8 }), 0, h, 0);
  top.rotation.set(Math.PI / 2, 0, Math.PI / 2); top.rotation.order = 'YXZ'; top.rotation.x = Math.PI / 2; top.rotation.y = 0; top.rotation.z = 0;
  put(g, new THREE.BoxGeometry(wide + 0.2, 0.08, 0.5), horrorSurface('concrete', { color: 0x4d5753, roughness: 1, bump: 1.2 }), 0, 0.04, 0.12);
  if (text.length) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const cx = cv.getContext('2d');
    cx.fillStyle = 'rgba(20,26,24,0.85)'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    text.forEach((t, i) => { cx.font = `${i === 0 ? 800 : 600} ${i === 0 ? 34 : 26}px "Courier New", monospace`; cx.fillText(t, 128, 70 + i * 44); });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wide * 0.92, wide * 0.92), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.position.set(0, h * 0.62, 0.085); g.add(m);
  }
  w.collider({ x, y: h / 2, z, w: wide, h, d: 0.35 });
  return g;
}

/** A clipped hedge (solid). */
export function hedge(w, { x, z, len = 4, thick = 1.2, h = 1.7, along = 'x' }) {
  const gx = along === 'x' ? len : thick, gz = along === 'x' ? thick : len;
  box(w, { x, y: h / 2, z, w: gx, h, d: gz, kind: 'concrete', color: 0x233a28, rough: 1, bump: 3 });
  box(w, { x, y: h + 0.05, z, w: gx * 0.96, h: 0.2, d: gz * 0.92, kind: 'concrete', color: 0x2b4a30, rough: 1, bump: 3, shadow: false });
  w.collider({ x, y: h / 2, z, w: gx, h, d: gz });
}

/** A candle: a tiny flame sprite that flickers (no real light; the altar gets one lamp). */
export function candle(w, { x, y, z, scale = 1 }) {
  put(w.scene, new THREE.CylinderGeometry(0.025 * scale, 0.03 * scale, 0.16 * scale, 8), new THREE.MeshStandardMaterial({ color: 0xd9d2b8, roughness: 0.9 }), x, y + 0.08 * scale, z);
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xffb060, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  f.position.set(x, y + 0.2 * scale, z); f.scale.setScalar(0.28 * scale); w.scene.add(f);
  w.updaters.push(() => { f.material.opacity = 0.6 + 0.3 * Math.sin(w.t * 17 + x * 9) * Math.sin(w.t * 5.3 + z); f.scale.setScalar((0.24 + 0.05 * Math.sin(w.t * 13 + x)) * scale); });
  return f;
}

/** A pew (church bench): seat + back, solid. Runs along x at rot 0. */
export function pew(w, { x, z, len = 4.2, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  put(g, new THREE.BoxGeometry(len, 0.08, 0.5), mat('wood'), 0, 0.46, 0);
  put(g, new THREE.BoxGeometry(len, 0.7, 0.07), mat('wood'), 0, 0.85, -0.25);
  for (const s of [-1, 1]) put(g, new THREE.BoxGeometry(0.1, 0.95, 0.62), mat('wood'), s * (len / 2 - 0.05), 0.48, -0.1);
  const sw = Math.abs(Math.cos(rot)) > 0.7;
  w.collider({ x, y: 0.5, z, w: sw ? len : 0.7, h: 1.0, d: sw ? 0.7 : len });
}

/** A hospital trolley holding a covered tray, decor + solid (not the tipping one). */
export function slabTable(w, { x, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  put(g, new THREE.BoxGeometry(0.9, 0.06, 2.1), mat('tray'), 0, 0.92, 0);
  put(g, new THREE.BoxGeometry(0.96, 0.05, 2.16), mat('steel'), 0, 0.86, 0);
  for (const [px, pz] of [[-0.35, -0.9], [0.35, -0.9], [-0.35, 0.9], [0.35, 0.9]]) put(g, new THREE.CylinderGeometry(0.04, 0.05, 0.86, 8), mat('steel'), px, 0.43, pz);
  put(g, new THREE.BoxGeometry(0.6, 0.06, 1.6), mat('steel'), 0, 0.2, 0);
  const sb = sheetBody(1.75, true); sb.group.position.set(0, 0.95, -0.1); g.add(sb.group);
  const gt = put(g, new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), mat('tray'), 0.34, 0.5, 1.2); gt.rotation.z = 0.3;
  const sw = Math.abs(Math.cos(rot)) > 0.7;
  w.collider({ x, y: 0.5, z, w: sw ? 1.0 : 2.2, h: 1.0, d: sw ? 2.2 : 1.0 });
  return { group: g, body: sb };
}
