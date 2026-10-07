import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { softTexture } from '../../engine/materials.js';

// What you see out of the lobby windows: a living night city.
//  · a street grid of towers with lit windows (one merged mesh), a few windows that blink
//  · to the west the rival HOTEL HONEST, whose neon flickers VACANCY / NO VACANCY
//  · to the east a billboard for Hotel Trust-Me that cycles through its "reviews"
//  · to the south a neon FREE CHECK-OUT* sign
//  · a blimp towing a banner, a big moon, slow clouds, aircraft beacons
// Everything is procedural. The hotel sits in the middle block; the lobby floor is at y = 0, the street at y = GROUND.

const GROUND = -25;
const PITCH = 64, CZ = -4;            // block pitch, z of the central block
const WIN_W = 3.2, FLOOR_H = 4.0;     // one window cell (metres)
const FONT = '"Archivo Black", Impact, sans-serif';

const rng = (seed) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const toTexture = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

// ---- textures -------------------------------------------------------------------------------------
function windowsTexture(kind = 0) {      // 0: apartments (warm, patchy), 1: offices (cool, whole floors lit)
  const S = 256, N = 8, C = S / N, rnd = rng(kind ? 17 : 5);
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = kind ? '#06070f' : '#07060f'; g.fillRect(0, 0, S, S);
  const warm = ['#ffd68a', '#ffe9b8', '#ffc070', '#fff3d8', '#ffb35a'], cool = ['#a8c8ff', '#c8dcff'], office = ['#cfe0ff', '#e6f0ff', '#bcd2ff', '#fff6dc'];
  const rowLit = Array.from({ length: N }, () => rnd() < 0.55);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = rnd(), px = x * C, py = y * C;
    g.fillStyle = 'rgba(30,26,60,0.7)'; g.fillRect(px, py + C - 3, C, 3);                      // the floor slab
    if (kind) {
      const lit = rowLit[y] && r < 0.85;
      g.fillStyle = lit ? office[Math.floor(rnd() * office.length)] : '#10132a';
      g.fillRect(px + 2, py + 6, C - 4, C - 13);                                               // ribbon windows: nearly the full cell
      if (lit) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px + C / 2 - 0.5, py + 6, 1, C - 13); }
      continue;
    }
    g.fillStyle = r < 0.5 ? warm[Math.floor(rnd() * warm.length)] : r < 0.58 ? cool[Math.floor(rnd() * cool.length)] : r < 0.78 ? '#2b2558' : '#161230';
    g.fillRect(px + 6, py + 5, C - 12, C - 12);
    if (r < 0.58) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px + C / 2 - 1, py + 5, 2, C - 12); }   // mullion
  }
  const t = toTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function neon(g, text, x, y, size, color, glow = color, weight = '') {
  g.font = `${weight}${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = glow; g.shadowBlur = size * 0.5; g.lineWidth = Math.max(2, size / 14); g.strokeStyle = color; g.strokeText(text, x, y);
  g.shadowBlur = size * 0.22; g.fillStyle = '#fff'; g.globalAlpha = 0.75; g.fillText(text, x, y); g.globalAlpha = 1; g.shadowBlur = 0;
}
function frame(g, W, H, color) {
  g.fillStyle = '#080812'; g.fillRect(0, 0, W, H);
  g.shadowColor = color; g.shadowBlur = 24; g.strokeStyle = color; g.lineWidth = 8; g.strokeRect(14, 14, W - 28, H - 28); g.shadowBlur = 0;
}

function honestTexture() {
  const W = 1024, H = 512, [c, g] = makeCanvas(W, H);
  frame(g, W, H, '#ff4fa3');
  neon(g, 'HOTEL', W / 2, 120, 110, '#ff4fa3');
  neon(g, 'HONEST', W / 2, 270, 210, '#46f0ff');
  g.font = `38px ${FONT}`; g.fillStyle = '#9fb4c8'; g.textAlign = 'center'; g.fillText('★ stairs available ★', W / 2, 425);
  return toTexture(c);
}

function vacancyTexture(state) {      // 'on' | 'flicker' | 'no'
  const W = 1024, H = 410, [c, g] = makeCanvas(W, H);
  frame(g, W, H, state === 'no' ? '#ff3b3b' : '#52ff9a');
  if (state === 'on') neon(g, 'VACANCY', W / 2, H / 2, 150, '#52ff9a');
  else if (state === 'flicker') { neon(g, 'VAC', W / 2 - 250, H / 2, 150, '#52ff9a'); neon(g, 'NCY', W / 2 + 270, H / 2, 150, '#52ff9a'); }
  else { neon(g, 'NO VACANCY', W / 2, H / 2 - 20, 130, '#ff3b3b'); g.font = `32px ${FONT}`; g.fillStyle = '#ff9a9a'; g.textAlign = 'center'; g.fillText('(only for you)', W / 2, H - 70); }
  return toTexture(c);
}

function slogan(lines, color, glow, border) {
  const W = 1024, H = 512, [c, g] = makeCanvas(W, H);
  frame(g, W, H, border);
  const total = lines.length; lines.forEach((l, i) => neon(g, l.text, W / 2, H / 2 + (i - (total - 1) / 2) * 140, l.size, l.color || color, l.glow || glow));
  return toTexture(c);
}

function adTexture(lines) {
  const W = 1024, H = 512, [c, g] = makeCanvas(W, H);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#171244'); bg.addColorStop(1, '#2a0f32'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#d8a94a'; g.lineWidth = 10; g.strokeRect(12, 12, W - 24, H - 24); g.lineWidth = 3; g.strokeRect(28, 28, W - 56, H - 56);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const total = lines.reduce((a, l) => a + l.size * 1.25, 0); let y = H / 2 - total / 2;
  for (const l of lines) {
    y += l.size * 0.625; g.font = `${l.size}px ${l.font || FONT}`; g.fillStyle = l.color || '#f6e3b0';
    g.shadowColor = l.glow || '#d8a94a'; g.shadowBlur = 14; g.fillText(l.text, W / 2, y); g.shadowBlur = 0; y += l.size * 0.625;
  }
  g.fillStyle = '#d8a94a'; g.font = `26px ${FONT}`; g.fillText('HOTEL TRUST-ME', W / 2, H - 52);
  return toTexture(c);
}
const ADS = [
  [{ text: '★★★★★', size: 90, color: '#ffd45a' }, { text: '“Best hotel I have ever', size: 54 }, { text: 'been unable to leave.”', size: 54 }, { text: '— A Guest, Day 41', size: 34, color: '#9fb4c8', glow: '#000' }],
  [{ text: 'NOW WITH', size: 70 }, { text: '47% FEWER', size: 130, color: '#ff6a6a', glow: '#ff2d4d' }, { text: 'EXITS', size: 130, color: '#ff6a6a', glow: '#ff2d4d' }],
  [{ text: '“The elevator took me exactly', size: 46 }, { text: 'where I did not ask.”', size: 46 }, { text: '★★★★★', size: 80, color: '#ffd45a' }, { text: '— Mr. Floor 13', size: 34, color: '#9fb4c8', glow: '#000' }],
  [{ text: 'WHY TAKE THE STAIRS?', size: 76 }, { text: '(there are none)', size: 54, color: '#9fb4c8', glow: '#000' }],
  [{ text: 'CHECK-OUT TIME:', size: 60 }, { text: '11:00 AM', size: 140, color: '#46f0ff', glow: '#46f0ff' }, { text: 'YESTERDAY', size: 70, color: '#ff6a6a', glow: '#ff2d4d' }],
  [{ text: 'TRUST ME.', size: 150, color: '#ffe3a0' }, { text: 'IT WILL BE FINE.', size: 64 }],
];

function checkoutTexture() {
  const W = 1024, H = 320, [c, g] = makeCanvas(W, H);
  frame(g, W, H, '#ffb030');
  neon(g, 'FREE CHECK-OUT*', W / 2, 130, 112, '#ffb030', '#ff8a00');
  g.font = `28px ${FONT}`; g.fillStyle = '#c0a070'; g.textAlign = 'center'; g.fillText('*not available. at this hotel. ever.', W / 2, 250);
  return toTexture(c);
}

function bannerTexture() {
  const W = 2048, H = 256, [c, g] = makeCanvas(W, H);
  g.fillStyle = '#f4ecd6'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#7a1030'; g.fillRect(0, 0, W, 22); g.fillRect(0, H - 22, W, 22);
  g.fillStyle = '#10342b'; g.font = `130px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('HOTEL TRUST-ME  ★★★★★*  TRUST US', W / 2, H / 2 - 4);
  g.fillStyle = '#7a1030'; g.font = `34px ${FONT}`; g.fillText('*stars not verified', W - 230, H - 52);
  return toTexture(c);
}

function moonTexture() {
  const S = 512, [c, g] = makeCanvas(S, S), R = S / 2;
  const grad = g.createRadialGradient(R * 0.8, R * 0.8, 10, R, R, R); grad.addColorStop(0, '#fffdf2'); grad.addColorStop(0.7, '#e9e4d2'); grad.addColorStop(1, '#bdb9ac');
  g.fillStyle = grad; g.beginPath(); g.arc(R, R, R - 2, 0, 7); g.fill();
  const rnd = rng(9);
  for (let i = 0; i < 26; i++) { const a = rnd() * 7, d = Math.sqrt(rnd()) * R * 0.85, r = 8 + rnd() * 34; g.fillStyle = `rgba(120,115,100,${0.1 + rnd() * 0.16})`; g.beginPath(); g.arc(R + Math.cos(a) * d, R + Math.sin(a) * d, r, 0, 7); g.fill(); }
  return toTexture(c);
}

// ---- geometry -------------------------------------------------------------------------------------
function lotGeometry(l, rnd) {
  const g = new THREE.BoxGeometry(l.w, l.h, l.d);
  const uv = g.attributes.uv, col = new Float32Array(uv.count * 3);
  const dims = [[l.d, l.h], [l.d, l.h], [l.w, l.d], [l.w, l.d], [l.w, l.h], [l.w, l.h]];    // px nx py ny pz nz
  const ou = Math.floor(rnd() * 8) / 8, ov = Math.floor(rnd() * 8) / 8;
  const lit = (1.0 + rnd() * 0.8) * (l.kind ? 0.62 : 1), warmth = rnd();
  const tint = warmth < 0.6 ? [1, 0.95, 0.88] : [0.86, 0.93, 1];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k, [fw, fh] = dims[f], roof = f === 2 || f === 3;
    uv.setXY(i, uv.getX(i) * fw / (8 * WIN_W) + ou, uv.getY(i) * fh / (8 * FLOOR_H) + ov);
    const c = roof ? 0.05 : lit;
    col[i * 3] = c * tint[0]; col[i * 3 + 1] = c * tint[1]; col[i * 3 + 2] = c * tint[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.translate(l.x, (l.base ?? GROUND) + l.h / 2, l.z);
  return g;
}

function withColor(g, r, gr, b) {
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = r; col[i * 3 + 1] = gr; col[i * 3 + 2] = b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}

export function lobbyCity(w) {
  const rnd = rng(11), own = { tex: [], geo: [], mat: [] };
  const track = (arr, o) => { arr.push(o); return o; };
  const winTex = track(own.tex, windowsTexture(0)), winTexOffice = track(own.tex, windowsTexture(1));
  const group = new THREE.Group(); w.add(group);

  // ---- air: haze that thickens with distance, and the glow of a big city at night -------------------------
  if (w.scene.fog) { w.scene.fog.color.set(0x34285c); w.scene.fog.near = 45; w.scene.fog.far = 300; }
  w.skyUniforms?.uHorizon.value.set(0x5a3c78);
  {
    const [c, g] = makeCanvas(4, 256), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(255,150,90,0)'); gr.addColorStop(0.5, 'rgba(255,150,90,0)'); gr.addColorStop(0.6, 'rgba(255,150,90,0.08)'); gr.addColorStop(0.75, 'rgba(255,140,90,0.28)');
    gr.addColorStop(0.9, 'rgba(255,130,100,0.55)'); gr.addColorStop(1, 'rgba(255,120,110,0.35)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const t = track(own.tex, toTexture(c));
    const m = new THREE.Mesh(track(own.geo, new THREE.CylinderGeometry(470, 470, 260, 48, 1, true)), track(own.mat, new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false })));
    m.position.set(0, GROUND + 130, CZ); group.add(m);
  }

  // ---- the towers ---------------------------------------------------------------------------------
  // Low-rise next to the hotel, rising to a tall skyline in the distance, so there is sky (and a blimp) to see over the near roofs.
  const specials = [
    { x: -58, z: -5, w: 46, d: 62, h: 25 + 21 },     // west:  HOTEL HONEST, facade at x = -35
    { x: 58, z: -5, w: 46, d: 62, h: 25 + 22 },      // east:  the billboards, facade at x = 35
    { x: 0, z: 60, w: 96, d: 48, h: 25 + 22 },       // south: FREE CHECK-OUT*, facade at z = 36
  ];
  const overlaps = (l) => specials.some((q) => Math.abs(l.x - q.x) < (l.w + q.w) / 2 + 2 && Math.abs(l.z - q.z) < (l.d + q.d) / 2 + 2);
  const lots = [];
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
    if (i === 0 && j === 0) continue;
    const cx = i * PITCH, cz = CZ + j * PITCH, dist = Math.hypot(i, j);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      if (rnd() < 0.04 + 0.02 * dist) continue;                                    // gaps: the odd missing tower
      const topY = Math.min(8 + dist * dist * 8 * (0.5 + rnd()) + rnd() * 10, 125);
      const l = { x: cx + (a ? 1 : -1) * 12.5 + (rnd() - 0.5) * 2, z: cz + (b ? 1 : -1) * 12.5 + (rnd() - 0.5) * 2, w: 21 + rnd() * 3.5, d: 21 + rnd() * 3.5, h: topY - GROUND };
      if (!overlaps(l)) lots.push(l);
    }
  }
  lots.push(...specials);

  // stepped tops: taller towers get one or two setbacks, so the skyline is not a row of bricks
  const tiers = [];
  for (const l of lots) {
    if (l.h < 38 || rnd() < 0.3) continue;
    let top = (l.base ?? GROUND) + l.h, tw = l.w, td = l.d, tx = l.x, tz = l.z;
    for (let k = 0; k < (rnd() < 0.4 ? 2 : 1); k++) {
      tw *= 0.55 + rnd() * 0.2; td *= 0.55 + rnd() * 0.2;
      tx += (rnd() - 0.5) * (l.w - tw) * 0.8; tz += (rnd() - 0.5) * (l.d - td) * 0.8;
      const th = 5 + rnd() * 14;
      tiers.push({ x: tx, z: tz, w: tw, d: td, h: th, base: top, kind: l.kind }); top += th;
    }
    l.top = top;
  }
  lots.forEach((l) => { l.kind = rnd() < 0.4 ? 1 : 0; });
  tiers.forEach((t, i) => { t.kind = i % 2; });
  const all = [...lots, ...tiers];
  const geoOf = (kind) => track(own.geo, mergeGeometries(all.filter((l) => l.kind === kind).map((l) => lotGeometry(l, rnd))));
  const addCity = (kind, tex) => { const m = new THREE.Mesh(geoOf(kind), track(own.mat, new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, toneMapped: false }))); m.matrixAutoUpdate = false; group.add(m); };
  addCity(0, winTex); addCity(1, winTexOffice);

  // rooftop clutter: water tanks, air-conditioning boxes, antenna masts (dark silhouettes), and the odd neon sign
  const props = [], neons = [], masts = [];
  const box = (bw, bh, bd, x, y, z) => { const g = new THREE.BoxGeometry(bw, bh, bd); g.translate(x, y, z); return g; };
  for (const l of lots) {
    const roof = l.top ?? ((l.base ?? GROUND) + l.h), dist = Math.hypot(l.x, l.z + 4);
    const rx = () => l.x + (rnd() - 0.5) * l.w * 0.6, rz = () => l.z + (rnd() - 0.5) * l.d * 0.6;
    if (l.top) continue;                                                  // stepped towers have their clutter on the top step
    if (rnd() < 0.4) {                                                    // a water tank on legs
      const x = rx(), z = rz();
      const body = new THREE.CylinderGeometry(1.7, 1.7, 3.2, 12); body.translate(x, roof + 3.8, z);
      const lid = new THREE.ConeGeometry(1.9, 1.3, 12); lid.translate(x, roof + 6.05, z);
      props.push(body, lid);
      for (const [lx, lz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) props.push(box(0.18, 2.2, 0.18, x + lx, roof + 1.1, z + lz));
    }
    for (let k = 0; k < Math.floor(rnd() * 4); k++) props.push(box(1.6 + rnd() * 1.8, 1 + rnd() * 1.2, 1.4 + rnd() * 1.6, rx(), roof + 0.7, rz()));
    if (rnd() < 0.5) {                                                    // an antenna mast with a cross bar
      const x = rx(), z = rz(), mh = 8 + rnd() * 16;
      props.push(box(0.22, mh, 0.22, x, roof + mh / 2, z), box(2.4, 0.15, 0.15, x, roof + mh * 0.8, z), box(0.15, 0.15, 2.0, x, roof + mh * 0.6, z));
      if (dist < 130 && rnd() < 0.5) masts.push({ x, y: roof + mh + 0.4, z });
    }
    if (dist < 110 && rnd() < 0.16) {                                     // a rooftop neon sign
      const hue = [[1.9, 0.3, 0.9], [0.3, 1.8, 1.9], [1.9, 1.5, 0.3], [0.5, 1.9, 0.6]][Math.floor(rnd() * 4)];
      const sw = 5 + rnd() * 4, along = rnd() < 0.5;
      const g = box(along ? sw : 0.5, 1.5, along ? 0.5 : sw, rx(), roof + 1.9, rz()); neons.push(withColor(g, ...hue));
    }
    if (dist < 120 && l.h > 60 && rnd() < 0.3) {                          // a lit vertical strip up one corner
      const hue = [[0.5, 1.6, 1.9], [1.9, 0.5, 1.2], [1.9, 1.3, 0.5]][Math.floor(rnd() * 3)];
      const sx = rnd() < 0.5 ? 1 : -1, sz = rnd() < 0.5 ? 1 : -1;
      neons.push(withColor(box(0.35, l.h * 0.8, 0.35, l.x + sx * (l.w / 2 + 0.1), (l.base ?? GROUND) + l.h * 0.5, l.z + sz * (l.d / 2 + 0.1)), ...hue));
    }
  }
  // a few clutter pieces on the top step of the stepped towers
  for (const t of tiers) {
    const roof = t.base + t.h; if (rnd() < 0.5) continue;
    props.push(box(1.4 + rnd() * 1.5, 1.2, 1.3 + rnd(), t.x + (rnd() - 0.5) * t.w * 0.5, roof + 0.6, t.z + (rnd() - 0.5) * t.d * 0.5));
    if (rnd() < 0.5) { const mh = 6 + rnd() * 12; props.push(box(0.22, mh, 0.22, t.x, roof + mh / 2, t.z)); if (Math.hypot(t.x, t.z + 4) < 130 && rnd() < 0.6) masts.push({ x: t.x, y: roof + mh + 0.4, z: t.z }); }
  }
  const propsMesh = new THREE.Mesh(track(own.geo, mergeGeometries(props)), track(own.mat, new THREE.MeshBasicMaterial({ color: 0x0b0a1a })));
  propsMesh.matrixAutoUpdate = false; group.add(propsMesh);
  if (neons.length) { const nm = new THREE.Mesh(track(own.geo, mergeGeometries(neons)), track(own.mat, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }))); nm.matrixAutoUpdate = false; group.add(nm); }

  // ground: dark asphalt with street lines (only seen from way up at the ledge)
  const gc = makeCanvas(256, 256); gc[1].fillStyle = '#0a0a14'; gc[1].fillRect(0, 0, 256, 256);
  gc[1].fillStyle = '#17172a'; gc[1].fillRect(0, 0, 256, 56); gc[1].fillRect(0, 0, 56, 256);
  gc[1].fillStyle = '#c8a050'; for (let k = 0; k < 256; k += 24) { gc[1].fillRect(k, 26, 12, 3); gc[1].fillRect(26, k, 3, 12); }
  const gt = track(own.tex, toTexture(gc[0])); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(1000 / PITCH, 1000 / PITCH);
  const gm = track(own.mat, new THREE.MeshBasicMaterial({ map: gt, color: 0x9a9ab0 }));
  const ground = new THREE.Mesh(track(own.geo, new THREE.PlaneGeometry(1000, 1000)), gm); ground.rotation.x = -Math.PI / 2; ground.position.set(0, GROUND - 0.05, CZ); group.add(ground);

  // ---- signs on the three special towers ------------------------------------------------------------
  // One board per window, placed where that window frames the facade when you stand in the aisle (the wall between the windows hides the rest).
  const signMat = (tex, k = 1) => track(own.mat, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(k, k, k), toneMapped: false }));   // k > 1 makes it bloom
  const board = (mat, w2, h2, x, y, z, ry) => { const m = new THREE.Mesh(track(own.geo, new THREE.PlaneGeometry(w2, h2)), mat); m.position.set(x, y, z); m.rotation.y = ry; group.add(m); return m; };
  const SZ = [-24.8, -12, 0.8, 13.6], SX = [-36, -20, 20, 36], SY = 10.5;
  const vac = { on: vacancyTexture('on'), flicker: vacancyTexture('flicker'), no: vacancyTexture('no') };
  Object.values(vac).forEach((t) => own.tex.push(t));
  const vacMat = signMat(vac.on, 1.3);
  board(signMat(track(own.tex, honestTexture()), 1.25), 10, 5, -34.9, SY, SZ[0], Math.PI / 2);                // west: HOTEL HONEST ...
  board(vacMat, 9, 3.6, -34.9, SY, SZ[1], Math.PI / 2);                                                       // ... its VACANCY sign ...
  board(signMat(track(own.tex, slogan([{ text: 'ELEVATORS THAT', size: 78 }, { text: 'GO WHERE YOU PRESS', size: 78 }], '#46f0ff', '#46f0ff', '#46f0ff')), 1.25), 10, 5, -34.9, SY, SZ[2], Math.PI / 2);   // ... and two digs at us
  board(signMat(track(own.tex, slogan([{ text: 'NO TRICKS', size: 100 }, { text: 'NO LIES', size: 100 }, { text: 'NO FLOOR 13', size: 70, color: '#ff4fa3', glow: '#ff4fa3' }], '#ffe05a', '#ffb000', '#ffe05a')), 1.25), 10, 5, -34.9, SY, SZ[3], Math.PI / 2);
  const ads = ADS.map((l) => track(own.tex, adTexture(l)));
  const adMats = Array.from({ length: 8 }, (_, k) => signMat(ads[k % ads.length], 1.15));
  SZ.forEach((z, k) => board(adMats[k], 10, 5, 34.9, SY, z, -Math.PI / 2));                                    // east: four billboards
  board(signMat(track(own.tex, checkoutTexture()), 1.3), 14, 4.4, 0, 11, 35.9, Math.PI);                     // south: FREE CHECK-OUT* ...
  SX.forEach((x, k) => board(adMats[4 + k], 12, 6, x, 11, 35.9, Math.PI));                                    // ... with boards either side
  const lampMat = track(own.mat, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.5, 1.2), toneMapped: false }));
  for (const z of SZ) for (const dz of [-3, 0, 3]) { const lamp = new THREE.Mesh(track(own.geo, new THREE.BoxGeometry(0.5, 0.3, 1.2)), lampMat); lamp.position.set(34.4, SY + 3.1, z + dz); group.add(lamp); }

  // ---- blinking windows on the near facades (kept off the boards) -------------------------------------
  const cells = [];
  const free = (z) => SZ.every((q) => Math.abs(z - q) > 5.8);
  for (let k = 0; k < 110; k++) {
    const side = k % 3;
    let y, z, x;
    for (let tries = 0; tries < 20; tries++) {
      y = -2 + Math.floor(rnd() * 14) * FLOOR_H * 0.6;
      if (side < 2) { z = -30 + Math.floor(rnd() * 20) * WIN_W; if (y > 5 && y < 16.5 && !free(z)) continue; x = side === 0 ? -34.8 : 34.8; }
      else { x = -44 + Math.floor(rnd() * 28) * WIN_W; z = 35.8; if (y > 6 && y < 17 && [0, ...SX].every((q) => Math.abs(x - q) > 7.2)) { /* fine */ } else if (y > 6 && y < 17) continue; }
      break;
    }
    cells.push({ x, y, z, ry: side === 0 ? Math.PI / 2 : side === 1 ? -Math.PI / 2 : Math.PI });
  }
  const winGeo = track(own.geo, new THREE.PlaneGeometry(2.0, 2.4));
  const blink = new THREE.InstancedMesh(winGeo, track(own.mat, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), cells.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), tmpC = new THREE.Color();
  cells.forEach((c, i) => { q.setFromEuler(new THREE.Euler(0, c.ry, 0)); m4.compose(new THREE.Vector3(c.x, c.y, c.z), q, one); blink.setMatrixAt(i, m4); blink.setColorAt(i, tmpC.setRGB(0, 0, 0)); });
  blink.instanceColor.needsUpdate = true; blink.frustumCulled = false; group.add(blink);
  const TV = 12;                                                  // the last few windows are somebody's television
  const warm = [new THREE.Color(1.5, 1.2, 0.7), new THREE.Color(1.4, 1.35, 1.1), new THREE.Color(0.8, 1.0, 1.5)];

  // ---- the sky ------------------------------------------------------------------------------------------
  const moonTex = track(own.tex, moonTexture());
  const moon = new THREE.Mesh(track(own.geo, new THREE.CircleGeometry(40, 48)), track(own.mat, new THREE.MeshBasicMaterial({ map: moonTex, color: new THREE.Color(1.15, 1.15, 1.2), fog: false, toneMapped: false })));
  moon.position.set(-170, 175, 330); moon.lookAt(0, 1.6, 0); group.add(moon);
  const halo = new THREE.Sprite(track(own.mat, new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0x9db4ff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  w.skyUniforms?.uSunDir.value.copy(moon.position).normalize();     // the sky's own sun glow sits right behind the moon
  halo.position.copy(moon.position).multiplyScalar(0.98); halo.scale.set(230, 230, 1); group.add(halo);

  const cloudMat = track(own.mat, new THREE.SpriteMaterial({ map: softTexture('puff'), color: 0x4a4488, transparent: true, opacity: 0.32, depthWrite: false, fog: false }));
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(cloudMat); const a = rnd() * Math.PI * 2, r = 260 + rnd() * 60;
    s.position.set(Math.cos(a) * r, 60 + rnd() * 90, CZ + Math.sin(a) * r); s.scale.set(90 + rnd() * 90, 20 + rnd() * 14, 1); s.userData.speed = 0.5 + rnd() * 1.2; clouds.push(s); group.add(s);
  }

  // aircraft beacons on the tallest towers
  const beaconMat = track(own.mat, new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xff3030, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
  const spots = lots.filter((l) => l.h > 95).slice(0, 12).map((l) => ({ x: l.x, y: (l.top ?? GROUND + l.h) + 1.5, z: l.z })).concat(masts.slice(0, 18));
  const beacons = spots.map((p) => { const s = new THREE.Sprite(beaconMat.clone()); own.mat.push(s.material); s.position.set(p.x, p.y, p.z); s.scale.set(6, 6, 1); s.userData.phase = rnd() * 6; group.add(s); return s; });

  // ---- the blimp ------------------------------------------------------------------------------------------
  const blimp = new THREE.Group();
  const hull = new THREE.Mesh(track(own.geo, new THREE.SphereGeometry(1, 28, 16)), track(own.mat, new THREE.MeshStandardMaterial({ color: 0x23284a, roughness: 0.5, metalness: 0.2 })));
  hull.scale.set(15, 4.6, 4.6); blimp.add(hull);
  const stripe = new THREE.Mesh(track(own.geo, new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, Math.PI * 0.46, Math.PI * 0.08)), track(own.mat, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.1, 0.5), toneMapped: false })));
  stripe.scale.set(15.05, 4.65, 4.65); blimp.add(stripe);
  const gondola = new THREE.Mesh(track(own.geo, new THREE.BoxGeometry(4.6, 1.3, 1.7)), track(own.mat, new THREE.MeshStandardMaterial({ color: 0x151728, roughness: 0.6 }))); gondola.position.set(1, -4.9, 0); blimp.add(gondola);
  const gwin = new THREE.Mesh(track(own.geo, new THREE.BoxGeometry(3.4, 0.42, 1.75)), track(own.mat, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 0.9), toneMapped: false }))); gwin.position.set(1, -4.85, 0); blimp.add(gwin);
  for (const [sy, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const fin = new THREE.Mesh(track(own.geo, new THREE.BoxGeometry(3.2, sy ? 3.2 : 0.18, sz ? 3.2 : 0.18)), hull.material); fin.position.set(-14, sy * 1.6, sz * 1.6); blimp.add(fin); }
  const bannerMat = track(own.mat, new THREE.MeshBasicMaterial({ map: track(own.tex, bannerTexture()), side: THREE.DoubleSide, toneMapped: false, color: new THREE.Color(0.9, 0.9, 0.9) }));
  const banner = new THREE.Mesh(track(own.geo, new THREE.PlaneGeometry(40, 5)), bannerMat); banner.position.set(-36, 0, 0); blimp.add(banner);
  for (const [bx, c] of [[-20, 0xff2020], [16, 0x20ff60]]) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); own.mat.push(s.material); s.position.set(bx > 0 ? 15 : -14, 3.2, bx > 0 ? 3 : -3); s.scale.set(5, 5, 1); blimp.add(s); }
  blimp.scale.setScalar(2.1); group.add(blimp);

  // ---- things that move: an elevated monorail, a helicopter with a searchlight ----------------------------
  const TRACK_Z = 29.2, TRACK_Y = 8;
  {
    const parts = [box(480, 0.9, 2.8, 0, TRACK_Y - 0.45, TRACK_Z)];
    for (let x = -216; x <= 216; x += 36) parts.push(box(1.4, TRACK_Y - GROUND - 0.9, 1.4, x, GROUND + (TRACK_Y - GROUND - 0.9) / 2, TRACK_Z));
    const tm = new THREE.Mesh(track(own.geo, mergeGeometries(parts)), track(own.mat, new THREE.MeshBasicMaterial({ color: 0x15122a })));
    tm.matrixAutoUpdate = false; group.add(tm);
    for (const dz of [-1.25, 1.25]) { const lm = new THREE.Mesh(track(own.geo, new THREE.BoxGeometry(480, 0.07, 0.1)), track(own.mat, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.25, 0.7), toneMapped: false }))); lm.position.set(0, TRACK_Y - 0.95, TRACK_Z + dz); group.add(lm); }
  }
  const trainTex = (() => {
    const [c, g] = makeCanvas(512, 64);
    const body = g.createLinearGradient(0, 0, 0, 64); body.addColorStop(0, '#3a3f66'); body.addColorStop(1, '#1c1f38'); g.fillStyle = body; g.fillRect(0, 0, 512, 64);
    g.fillStyle = '#c8a050'; g.fillRect(0, 50, 512, 4);
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 5 === 3 ? '#bcd8ff' : '#ffe6a8'; g.fillRect(14 + i * 41, 12, 30, 22); }
    return track(own.tex, toTexture(c));
  })();
  const trainMat = track(own.mat, new THREE.MeshBasicMaterial({ map: trainTex, color: new THREE.Color(1.2, 1.2, 1.2), toneMapped: false }));
  const CARS = 6, CAR_L = 7.2, TRAIN_L = CARS * CAR_L, LOOP = 480 + TRAIN_L;
  const trains = [0, 1].map((k) => {
    const g = new THREE.Group();
    for (let i = 0; i < CARS; i++) { const car = new THREE.Mesh(track(own.geo, new THREE.BoxGeometry(CAR_L - 0.35, 3, 2.9)), trainMat); car.position.set(-i * CAR_L, 0, 0); g.add(car); }
    const head = new THREE.Sprite(track(own.mat, new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xfff0d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    head.position.set(CAR_L / 2, -0.4, 0); head.scale.set(5, 5, 1); g.add(head);
    g.position.y = TRACK_Y + 1.6; g.position.z = TRACK_Z; group.add(g); g.userData.phase = k * LOOP / 2; return g;
  });

  const heli = new THREE.Group();
  {
    const dark = track(own.mat, new THREE.MeshBasicMaterial({ color: 0x12112a }));
    const body = new THREE.Mesh(track(own.geo, new THREE.SphereGeometry(1, 14, 10)), dark); body.scale.set(2.2, 1.2, 1.2); heli.add(body);
    const tail = new THREE.Mesh(track(own.geo, new THREE.BoxGeometry(4, 0.35, 0.35)), dark); tail.position.set(-3.6, 0.2, 0); heli.add(tail);
    const fin = new THREE.Mesh(track(own.geo, new THREE.BoxGeometry(0.3, 1.5, 0.3)), dark); fin.position.set(-5.4, 0.7, 0); heli.add(fin);
    for (const dz of [-0.8, 0.8]) { const skid = new THREE.Mesh(track(own.geo, new THREE.BoxGeometry(3.2, 0.1, 0.12)), dark); skid.position.set(0.2, -1.5, dz); heli.add(skid); }
    heli.userData.rotor = new THREE.Group(); heli.userData.rotor.position.y = 1.35;
    for (const ry of [0, Math.PI / 2]) { const blade = new THREE.Mesh(track(own.geo, new THREE.BoxGeometry(7, 0.05, 0.28)), dark); blade.rotation.y = ry; heli.userData.rotor.add(blade); }
    heli.add(heli.userData.rotor);
    heli.userData.nav = [[0xff2020, -0.2, 0, -1.3], [0x20ff60, -0.2, 0, 1.3], [0xffffff, -5.4, 1.5, 0]].map(([c, x, y, z]) => {
      const sp = new THREE.Sprite(track(own.mat, new THREE.SpriteMaterial({ map: softTexture('glow'), color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))); sp.position.set(x, y, z); sp.scale.set(2.6, 2.6, 1); heli.add(sp); return sp;
    });
    heli.scale.setScalar(1.7); group.add(heli);
  }
  const beam = new THREE.Mesh(track(own.geo, new THREE.CylinderGeometry(0.08, 1.7, 1, 14, 1, true)), track(own.mat, new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false })));
  group.add(beam);
  const pool = new THREE.Sprite(track(own.mat, new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xfff4dc, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  pool.scale.set(10, 10, 1); group.add(pool);
  const hv = new THREE.Vector3(), tv = new THREE.Vector3(), dv = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
  function movers(dt, t) {
    for (const g of trains) g.position.x = -240 - TRAIN_L + ((t * 13 + g.userData.phase) % LOOP);
    // the helicopter circles the hotel through the gap between it and the next block, its searchlight sweeping the facades
    const a = t * 0.12 + 1.2, hx = Math.cos(a) * 29, hz = CZ + Math.sin(a) * 33, hy = 14.5 + Math.sin(t * 0.37);
    heli.position.set(hx, hy, hz);
    heli.rotation.y = Math.atan2(-33 * Math.cos(a), -29 * Math.sin(a));                          // nose along the direction of travel
    heli.userData.rotor.rotation.y += dt * 40;
    heli.userData.nav[0].material.opacity = Math.sin(t * 3) > 0 ? 1 : 0.15; heli.userData.nav[1].material.opacity = Math.sin(t * 3 + 1.5) > 0 ? 1 : 0.15;
    heli.userData.nav[2].material.opacity = (t % 1.1) < 0.12 ? 1 : 0.05;
    hv.set(hx, hy - 1.5, hz);
    tv.set(hx < 0 ? -34.7 : 34.7, 11 + Math.sin(t * 0.5) * 4, hz + Math.sin(t * 0.9) * 7);
    dv.copy(tv).sub(hv); const len = dv.length(); dv.normalize();
    beam.position.copy(hv).addScaledVector(dv, len / 2); beam.quaternion.setFromUnitVectors(down, dv); beam.scale.set(1, len, 1);
    pool.position.copy(tv).addScaledVector(dv, -0.2);
  }

  // ---- animation ----------------------------------------------------------------------------------------
  let hState = 'on', hTimer = 6, adIdx = 0, adTimer = 6, blinkTimer = 0, tvTimer = 0;
  const cycle = [0, 3, 1, 2, 4, 5];
  w.onUpdate((dt) => {
    const t = w.t;
    // the blimp circles the hotel, banner trailing behind it
    const ang = 0.6 + t * 0.025, R = 170;
    blimp.position.set(Math.cos(ang) * R, 82 + Math.sin(t * 0.2) * 1.5, CZ + Math.sin(ang) * R);
    blimp.rotation.y = -ang + Math.PI;        // nose along the direction of travel
    for (const c of clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 340) c.position.x = -340; }
    for (const b of beacons) b.material.opacity = Math.sin(t * 2.4 + b.userData.phase) > 0.55 ? 1 : 0.08;
    // HOTEL HONEST: mostly VACANCY, with flickers and the odd NO VACANCY
    hTimer -= dt;
    if (hTimer <= 0) {
      const r = Math.random();
      if (hState === 'on') { hState = r < 0.75 ? 'flicker' : 'no'; hTimer = hState === 'flicker' ? 0.12 + Math.random() * 0.2 : 2.5 + Math.random() * 2; }
      else if (hState === 'flicker') { hState = Math.random() < 0.5 ? 'on' : 'flicker'; hTimer = hState === 'on' ? 1.5 + Math.random() * 4 : 0.08 + Math.random() * 0.12; }
      else { hState = 'on'; hTimer = 3 + Math.random() * 5; }
      vacMat.map = vac[hState]; vacMat.needsUpdate = true;
    }
    adTimer -= dt;
    if (adTimer <= 0) {
      adTimer = 7; adIdx++;
      adMats.forEach((m, k) => { m.map = ads[cycle[(adIdx + k * 2) % cycle.length]]; m.needsUpdate = true; });
    }
    blinkTimer -= dt;
    if (blinkTimer <= 0) {
      blinkTimer = 0.12;
      for (let n = 0; n < 3; n++) { const i = Math.floor(Math.random() * (cells.length - TV)); blink.setColorAt(i, Math.random() < 0.55 ? warm[Math.floor(Math.random() * warm.length)] : tmpC.setRGB(0, 0, 0)); }
      blink.instanceColor.needsUpdate = true;
    }
    tvTimer -= dt;
    if (tvTimer <= 0) {                               // television light: quick, bluish, never quite the same twice
      tvTimer = 0.08;
      for (let n = cells.length - TV; n < cells.length; n++) { const k = 0.15 + Math.random() * 0.5; blink.setColorAt(n, tmpC.setRGB(0.25 * k, 0.55 * k, 1.5 * k)); }
      blink.instanceColor.needsUpdate = true;
    }
    movers(dt, t);
  });
  w.onDispose(() => { own.tex.forEach((t) => t.dispose()); own.mat.forEach((m) => m.dispose()); own.geo.forEach((g) => g.dispose()); blink.dispose(); });
  return { blimp, vacMat, adMats, heli, trains };
}
