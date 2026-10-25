import * as THREE from 'three';

// Lowtide surfaces: 512 px canvas textures drawn with a matching bump map, so the torch rakes across cracks, grout, peeling paint and rust.
// Everything is procedural (no image assets). Textures tile every 2 m on boxes made by engine/materials.js boxGeometry.

const S = 512;
const rnd = (() => { let a = 1234567; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')]; };

function speckle(ctx, n, a, light = 255, dark = 0) {
  for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${rnd() < 0.5 ? light : dark},${rnd() < 0.5 ? light : dark},${rnd() < 0.5 ? light : dark},${rnd() * a})`; ctx.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2); }
}
function blot(ctx, rgb, n, rMin, rMax, a) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * S, y = rnd() * S, r = rMin + rnd() * (rMax - rMin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a * (0.4 + rnd() * 0.6)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
function crack(ctx, bctx, x, y, len, w = 1.4) {
  let a = rnd() * 6.28;
  for (const c of [ctx, bctx]) { c.lineWidth = w; c.beginPath(); c.moveTo(x, y); }
  let px = x, py = y;
  for (let i = 0; i < len; i++) { a += (rnd() - 0.5) * 0.9; px += Math.cos(a) * 6; py += Math.sin(a) * 6; ctx.lineTo(px, py); bctx.lineTo(px, py); }
  ctx.strokeStyle = 'rgba(8,10,10,0.75)'; ctx.stroke();
  bctx.strokeStyle = 'rgba(0,0,0,0.9)'; bctx.stroke();
}

const BUILD = {
  // hospital wall tile: 8 x 8 per repeat (2 m), grimy grout, cracks, rust-coloured water streaks
  tile(c, b) {
    c.fillStyle = '#9fb0a8'; c.fillRect(0, 0, S, S); b.fillStyle = '#9a9a9a'; b.fillRect(0, 0, S, S);
    const n = 8, t = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 0.9 + rnd() * 0.2;
      c.fillStyle = `rgb(${(168 * v) | 0},${(186 * v) | 0},${(176 * v) | 0})`; c.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
      b.fillStyle = `rgb(${(190 + rnd() * 30) | 0},${(190 + rnd() * 30) | 0},${(190 + rnd() * 30) | 0})`; b.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
    }
    c.strokeStyle = 'rgba(30,34,30,0.9)'; c.lineWidth = 3; b.strokeStyle = '#000'; b.lineWidth = 4;
    for (let i = 0; i <= n; i++) for (const cc of [c, b]) { cc.beginPath(); cc.moveTo(i * t, 0); cc.lineTo(i * t, S); cc.moveTo(0, i * t); cc.lineTo(S, i * t); cc.stroke(); }
    blot(c, '70,50,28', 7, 40, 120, 0.35); blot(c, '10,14,12', 9, 40, 140, 0.4);
    for (let i = 0; i < 5; i++) crack(c, b, rnd() * S, rnd() * S, 8 + rnd() * 16);
    for (let i = 0; i < 9; i++) { const x = rnd() * S, h = 60 + rnd() * 260; const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(90,60,30,0.5)'); g.addColorStop(1, 'rgba(90,60,30,0)'); c.fillStyle = g; c.fillRect(x, 0, 2 + rnd() * 5, h); }
    speckle(c, 3000, 0.25);
  },
  // linoleum floor: dull green-grey, scuffs, a darker worn path, glossy where it is wet (low roughness read through bump)
  lino(c, b) {
    c.fillStyle = '#5d6a62'; c.fillRect(0, 0, S, S); b.fillStyle = '#8a8a8a'; b.fillRect(0, 0, S, S);
    const t = S / 4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 0.86 + rnd() * 0.22; c.fillStyle = `rgb(${(88 * v) | 0},${(104 * v) | 0},${(96 * v) | 0})`; c.fillRect(i * t + 1, j * t + 1, t - 2, t - 2); }
    c.strokeStyle = 'rgba(12,14,12,0.85)'; c.lineWidth = 2; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * t, 0); c.lineTo(i * t, S); c.moveTo(0, i * t); c.lineTo(S, i * t); c.stroke(); }
    for (let i = 0; i < 40; i++) { c.strokeStyle = `rgba(${rnd() < 0.5 ? '230,235,230' : '20,24,22'},${rnd() * 0.25})`; c.lineWidth = 1 + rnd() * 2; c.beginPath(); const x = rnd() * S, y = rnd() * S; c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 120, y + (rnd() - 0.5) * 40); c.stroke(); }
    blot(c, '8,10,8', 10, 50, 150, 0.45); blot(c, '90,70,40', 4, 30, 90, 0.25);
    b.strokeStyle = '#000'; b.lineWidth = 3; for (let i = 0; i <= 4; i++) { b.beginPath(); b.moveTo(i * t, 0); b.lineTo(i * t, S); b.moveTo(0, i * t); b.lineTo(S, i * t); b.stroke(); }
    speckle(c, 5000, 0.2); speckle(b, 3000, 0.4);
  },
  // wall plaster: dirty teal paint below a rail, nicotine cream above (one repeat = one 3.4 m wall height), small peeling flakes, damp stains, mould at the ceiling
  plaster(c, b) {
    c.fillStyle = '#9a9a82'; c.fillRect(0, 0, S, S); b.fillStyle = '#9c9c9c'; b.fillRect(0, 0, S, S);
    c.fillStyle = '#5b7068'; c.fillRect(0, S * 0.62, S, S * 0.38);
    const g0 = c.createLinearGradient(0, 0, 0, S); g0.addColorStop(0, 'rgba(10,14,10,0.55)'); g0.addColorStop(0.25, 'rgba(10,14,10,0)'); g0.addColorStop(0.75, 'rgba(10,14,10,0)'); g0.addColorStop(1, 'rgba(10,14,10,0.5)'); c.fillStyle = g0; c.fillRect(0, 0, S, S);
    c.fillStyle = '#23282a'; c.fillRect(0, S * 0.62 - 5, S, 10); b.fillStyle = '#e4e4e4'; b.fillRect(0, S * 0.62 - 7, S, 14);
    blot(c, '70,56,30', 8, 60, 180, 0.28); blot(c, '14,18,14', 8, 60, 190, 0.34); blot(c, '30,44,26', 6, 30, 100, 0.4);
    for (let i = 0; i < 170; i++) {                                                                  // peeling flakes: small, many, pale where the paint has lifted
      const x = rnd() * S, y = rnd() * S, r = 1.5 + rnd() * 6.5;
      c.fillStyle = `rgba(${rnd() < 0.7 ? '150,146,124' : '40,40,34'},${0.35 + rnd() * 0.4})`; c.beginPath(); c.ellipse(x, y, r, r * (0.35 + rnd() * 0.6), rnd() * 6, 0, 7); c.fill();
      b.fillStyle = 'rgba(40,40,40,0.8)'; b.beginPath(); b.ellipse(x, y, r, r * 0.6, rnd() * 6, 0, 7); b.fill();
    }
    for (let i = 0; i < 16; i++) { const x = rnd() * S, h = 50 + rnd() * 320; const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(36,26,12,0.5)'); g.addColorStop(1, 'rgba(36,26,12,0)'); c.fillStyle = g; c.fillRect(x, 0, 1 + rnd() * 5, h); }
    for (let i = 0; i < 3; i++) crack(c, b, rnd() * S, rnd() * S, 12 + rnd() * 18);
    speckle(c, 7000, 0.22); speckle(b, 3500, 0.35);
  },
  concrete(c, b) {
    c.fillStyle = '#6b6f6e'; c.fillRect(0, 0, S, S); b.fillStyle = '#909090'; b.fillRect(0, 0, S, S);
    blot(c, '20,24,24', 14, 30, 130, 0.35); blot(c, '110,115,110', 12, 30, 120, 0.3); blot(c, '50,38,22', 4, 40, 110, 0.3);
    c.strokeStyle = 'rgba(10,12,12,0.55)'; c.lineWidth = 3; b.strokeStyle = '#111'; b.lineWidth = 4;
    for (const cc of [c, b]) { cc.beginPath(); cc.moveTo(0, S / 2); cc.lineTo(S, S / 2); cc.moveTo(S / 2, 0); cc.lineTo(S / 2, S); cc.stroke(); }
    for (let i = 0; i < 6; i++) crack(c, b, rnd() * S, rnd() * S, 10 + rnd() * 24);
    speckle(c, 9000, 0.3); speckle(b, 7000, 0.5);
  },
  rust(c, b) {
    c.fillStyle = '#4a4f55'; c.fillRect(0, 0, S, S); b.fillStyle = '#8a8a8a'; b.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 2) { c.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.07})`; c.fillRect(0, y, S, 2); }
    blot(c, '130,62,24', 24, 20, 90, 0.7); blot(c, '86,38,16', 14, 14, 60, 0.8); blot(c, '16,12,10', 8, 30, 90, 0.5);
    for (let i = 0; i < 160; i++) { b.fillStyle = `rgba(0,0,0,${rnd() * 0.5})`; b.beginPath(); b.arc(rnd() * S, rnd() * S, 1 + rnd() * 7, 0, 7); b.fill(); }
    c.strokeStyle = 'rgba(10,12,16,0.8)'; c.lineWidth = 5; c.strokeRect(2.5, 2.5, S - 5, S - 5); b.strokeStyle = '#000'; b.lineWidth = 6; b.strokeRect(3, 3, S - 6, S - 6);
    c.fillStyle = 'rgba(20,20,24,0.9)'; for (const [x, y] of [[26, 26], [S - 26, 26], [26, S - 26], [S - 26, S - 26]]) { c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); b.fillStyle = '#fff'; b.beginPath(); b.arc(x, y, 7, 0, 7); b.fill(); }
    speckle(c, 5000, 0.25);
  },
  // padded cell: quilted off-white vinyl diamonds, buttons, stains
  padded(c, b) {
    c.fillStyle = '#a9a496'; c.fillRect(0, 0, S, S); b.fillStyle = '#c4c4c4'; b.fillRect(0, 0, S, S);
    const n = 4, t = S / n;
    for (let i = -1; i <= n; i++) for (let j = -1; j <= n; j++) {
      const cx = i * t + (j % 2 ? t / 2 : 0), cy = j * t / 1 ;
      const g = c.createRadialGradient(cx, cy, 2, cx, cy, t * 0.72); g.addColorStop(0, 'rgba(255,255,240,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0.38)'); c.fillStyle = g; c.fillRect(cx - t, cy - t, t * 2, t * 2);
      const gb = b.createRadialGradient(cx, cy, 2, cx, cy, t * 0.72); gb.addColorStop(0, '#fff'); gb.addColorStop(1, '#222'); b.fillStyle = gb; b.fillRect(cx - t, cy - t, t * 2, t * 2);
      c.fillStyle = 'rgba(40,36,28,0.9)'; c.beginPath(); c.arc(cx, cy, 4, 0, 7); c.fill();
    }
    blot(c, '90,26,20', 6, 24, 90, 0.4); blot(c, '30,26,16', 8, 40, 130, 0.35);
    speckle(c, 4000, 0.18);
  },
  wood(c, b) {
    c.fillStyle = '#3a2a1e'; c.fillRect(0, 0, S, S); b.fillStyle = '#909090'; b.fillRect(0, 0, S, S);
    const n = 6, t = S / n;
    for (let i = 0; i < n; i++) { const v = 0.7 + rnd() * 0.5; c.fillStyle = `rgb(${(66 * v) | 0},${(46 * v) | 0},${(32 * v) | 0})`; c.fillRect(i * t + 1, 0, t - 2, S); for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(0,0,0,${rnd() * 0.25})`; c.fillRect(i * t + rnd() * t, rnd() * S, 1, 20 + rnd() * 80); } b.fillStyle = '#000'; b.fillRect(i * t, 0, 2, S); }
    blot(c, '8,8,6', 12, 40, 140, 0.45); speckle(c, 4000, 0.2);
  },
};

const cache = new Map();
/** A Lowtide surface material: albedo + bump (light-catching relief). `repeat` in textures per 2 m. */
export function horrorSurface(kind = 'tile', { color = 0xffffff, roughness = 0.85, metalness = 0.02, bump = 1.2, emissive = 0x000000, emissiveIntensity = 0 } = {}) {
  const key = [kind, color, roughness, metalness, bump, emissive, emissiveIntensity].join('|');
  if (cache.has(key)) return cache.get(key);
  const [cc, c] = mk(), [bc, b] = mk();
  (BUILD[kind] || BUILD.tile)(c, b);
  const map = new THREE.CanvasTexture(cc), bumpMap = new THREE.CanvasTexture(bc);
  if (kind === 'plaster') for (const t of [map, bumpMap]) t.repeat.set(1, 2 / 3.4);       // one repeat = the full wall height
  for (const t of [map, bumpMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  map.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: bump, color, roughness, metalness, emissive, emissiveIntensity });
  cache.set(key, m);
  return m;
}

/** A decal texture drawn on a transparent canvas: blood splatter, drag marks, handprints, scratches, words. */
const decalCache = new Map();
export function decalTexture(kind = 'splat', seed = 1) {
  const key = kind + seed;
  if (decalCache.has(key)) return decalCache.get(key);
  const [cc, c] = mk();
  let a = (seed * 9301 + 49297) >>> 0; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  c.clearRect(0, 0, S, S);
  const blood = (alpha) => `rgba(${70 + (r() * 30) | 0},${6 + (r() * 8) | 0},${8 + (r() * 8) | 0},${alpha})`;
  if (kind === 'splat') {
    const cx = S / 2, cy = S / 2;
    for (let i = 0; i < 70; i++) { const ang = r() * 6.28, d = Math.pow(r(), 1.7) * S * 0.42, rr = 2 + r() * (S * 0.05) * (1 - d / (S * 0.45)); c.fillStyle = blood(0.85); c.beginPath(); c.arc(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, rr, 0, 7); c.fill(); }
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, S * 0.2); g.addColorStop(0, blood(0.95)); g.addColorStop(1, blood(0)); c.fillStyle = g; c.fillRect(0, 0, S, S);
  } else if (kind === 'drag') {
    c.strokeStyle = blood(0.7); c.lineCap = 'round';
    for (let k = 0; k < 3; k++) { c.lineWidth = 16 + r() * 18; c.beginPath(); c.moveTo(S * 0.1, S * (0.35 + k * 0.12)); c.bezierCurveTo(S * 0.4, S * (0.3 + r() * 0.4), S * 0.6, S * (0.3 + r() * 0.4), S * 0.95, S * (0.4 + k * 0.1)); c.stroke(); }
    for (let i = 0; i < 40; i++) { c.fillStyle = blood(0.6); c.beginPath(); c.arc(S * 0.1 + r() * S * 0.85, S * (0.3 + r() * 0.4), 2 + r() * 5, 0, 7); c.fill(); }
  } else if (kind === 'hand') {
    c.fillStyle = blood(0.82); c.beginPath(); c.ellipse(S / 2, S * 0.62, S * 0.16, S * 0.2, 0, 0, 7); c.fill();
    for (let i = 0; i < 5; i++) { const ang = -1.1 + i * 0.5, len = S * (0.2 + (i === 2 ? 0.07 : 0) - (i === 4 ? 0.06 : 0)); c.save(); c.translate(S / 2 + Math.cos(ang) * S * 0.04, S * 0.5); c.rotate(ang + Math.PI / 2 - Math.PI / 2); c.fillRect(-S * 0.025, -len, S * 0.05, len); c.restore(); }
    for (let i = 0; i < 18; i++) { c.fillStyle = blood(0.5); c.fillRect(S * 0.35 + r() * S * 0.3, S * 0.72 + r() * S * 0.25, 3, 10 + r() * 60); }
  } else if (kind === 'scratch') {
    c.strokeStyle = 'rgba(14,12,10,0.85)'; c.lineWidth = 3;
    for (let k = 0; k < 4; k++) for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(S * (0.15 + i * 0.04) + k * S * 0.2, S * 0.1); c.lineTo(S * (0.18 + i * 0.04) + k * S * 0.2, S * 0.9); c.stroke(); }
    c.strokeStyle = 'rgba(14,12,10,0.85)'; c.lineWidth = 4; c.beginPath(); c.moveTo(S * 0.1, S * 0.5); c.lineTo(S * 0.95, S * 0.45); c.stroke();
  } else if (kind === 'puddle') {
    const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(6,10,12,0.9)'); g.addColorStop(0.7, 'rgba(6,10,12,0.8)'); g.addColorStop(1, 'rgba(6,10,12,0)'); c.fillStyle = g;
    c.beginPath(); for (let i = 0; i <= 40; i++) { const ang = (i / 40) * 6.28, rr = S * (0.34 + r() * 0.14); const x = S / 2 + Math.cos(ang) * rr, y = S / 2 + Math.sin(ang) * rr * 0.8; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); c.fill();
  }
  const t = new THREE.CanvasTexture(cc); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  decalCache.set(key, t);
  return t;
}
