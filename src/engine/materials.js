import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Everything visual is procedural: canvas textures + rounded boxes. No image assets to ship.

const TILE = 2; // metres covered by one texture repeat

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function noise(ctx, w, h, amount, alpha = 1) {
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

const TEX_BUILDERS = {
  // clean studio tile: soft white with a recessed seam and a bright bevel
  tile(ctx, S) {
    ctx.fillStyle = '#ecebf0'; ctx.fillRect(0, 0, S, S);
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(120,120,150,0.10)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(70,70,100,0.55)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, S - 6, S - 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.strokeRect(8, 8, S - 16, S - 16);
    ctx.fillStyle = 'rgba(80,80,110,0.13)';
    for (let i = 0; i < 6; i++) { // faint scuffs
      ctx.beginPath(); ctx.ellipse(Math.random() * S, Math.random() * S, 20 + Math.random() * 30, 2 + Math.random() * 3, Math.random() * 3, 0, 7); ctx.fill();
    }
    noise(ctx, S, S, 9);
  },
  // dark brushed steel with panel seams + rivets (tower)
  metal(ctx, S) {
    ctx.fillStyle = '#9aa1ad'; ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 2) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.06})`; ctx.fillRect(0, y, S, 2); }
    ctx.strokeStyle = 'rgba(20,24,34,0.65)'; ctx.lineWidth = 5; ctx.strokeRect(2.5, 2.5, S - 5, S - 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2; ctx.strokeRect(8, 8, S - 16, S - 16);
    ctx.fillStyle = 'rgba(25,28,38,0.8)';
    for (const [x, y] of [[20, 20], [S - 20, 20], [20, S - 20], [S - 20, S - 20]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
    noise(ctx, S, S, 14);
  },
  // dark panel with glowing grid lines (technical difficulties)
  grid(ctx, S) {
    ctx.fillStyle = '#1b2440'; ctx.fillRect(0, 0, S, S);
    const gg = ctx.createLinearGradient(0, 0, S, S); gg.addColorStop(0, 'rgba(90,120,255,0.18)'); gg.addColorStop(1, 'rgba(255,60,240,0.10)'); ctx.fillStyle = gg; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(80,220,255,0.9)'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, S - 4, S - 4);
    ctx.strokeStyle = 'rgba(80,220,255,0.18)'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(i * S / 4, 0); ctx.lineTo(i * S / 4, S); ctx.moveTo(0, i * S / 4); ctx.lineTo(S, i * S / 4); ctx.stroke(); }
    noise(ctx, S, S, 8);
  },
  // glossy stage boards with a gold inlay line (finale)
  stage(ctx, S) {
    ctx.fillStyle = '#6a3f48'; ctx.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 64) { ctx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.07})`; ctx.fillRect(x, 0, 62, S); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 62, 0, 2, S); }
    ctx.strokeStyle = 'rgba(255,200,90,0.85)'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, S - 8, S - 8);
    noise(ctx, S, S, 10);
  },
  // heavy velvet curtain: vertical folds
  curtain(ctx, S) {
    for (let x = 0; x < S; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, '#6a0f1c'); g.addColorStop(0.5, '#d8283f'); g.addColorStop(1, '#6a0f1c');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 16, S);
    }
    noise(ctx, S, S, 10);
  },
  // black & white marble checker (2x2 per tile) with veining and gold joints
  marble(ctx, S) {
    const H = S / 2, rnd = Math.random;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const dark = (x + y) % 2 === 1;
      ctx.fillStyle = dark ? '#15171d' : '#f3f0e9'; ctx.fillRect(x * H, y * H, H, H);
      for (let k = 0; k < 26; k++) { ctx.fillStyle = dark ? `rgba(120,115,130,${rnd() * 0.07})` : `rgba(150,150,165,${rnd() * 0.08})`; ctx.beginPath(); ctx.arc(x * H + rnd() * H, y * H + rnd() * H, 6 + rnd() * 26, 0, 7); ctx.fill(); }
      for (let k = 0; k < 6; k++) {
        ctx.strokeStyle = dark ? `rgba(210,200,180,${0.08 + rnd() * 0.18})` : `rgba(80,82,98,${0.08 + rnd() * 0.2})`;
        ctx.lineWidth = 0.5 + rnd() * 1.6; ctx.beginPath();
        let px = x * H + rnd() * H, py = y * H + rnd() * H; ctx.moveTo(px, py);
        for (let j = 0; j < 7; j++) { px += (rnd() - 0.5) * 46; py += (rnd() - 0.25) * 34; ctx.lineTo(px, py); }
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(214,170,78,0.95)'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, S - 3, S - 3);
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(H, 0); ctx.lineTo(H, S); ctx.moveTo(0, H); ctx.lineTo(S, H); ctx.stroke();
    noise(ctx, S, S, 5);
  },
  // burgundy carpet with a gold diamond lattice
  carpet(ctx, S) {
    ctx.fillStyle = '#6b0f24'; ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 2) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; ctx.fillRect(0, y, S, 1); }
    ctx.strokeStyle = 'rgba(220,175,80,0.8)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, S / 2); ctx.lineTo(S / 2, 0); ctx.lineTo(S, S / 2); ctx.lineTo(S / 2, S); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,175,80,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(S / 4, S / 2); ctx.lineTo(S / 2, S / 4); ctx.lineTo(S * 0.75, S / 2); ctx.lineTo(S / 2, S * 0.75); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = 'rgba(230,185,90,0.9)';
    for (const [x, y] of [[S / 2, S / 2], [0, 0], [S, 0], [0, S], [S, S]]) { ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); }
    noise(ctx, S, S, 16);
  },
  // deep green damask wallpaper
  damask(ctx, S) {
    ctx.fillStyle = '#10342b'; ctx.fillRect(0, 0, S, S);
    const motif = (cx, cy, k) => {
      ctx.fillStyle = 'rgba(214,170,78,0.5)';
      ctx.beginPath(); ctx.ellipse(cx, cy, 10 * k, 34 * k, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx - 20 * k, cy + 8 * k, 8 * k, 24 * k, -0.9, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 20 * k, cy + 8 * k, 8 * k, 24 * k, 0.9, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(8,36,28,0.9)';
      ctx.beginPath(); ctx.ellipse(cx, cy, 4 * k, 20 * k, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(214,170,78,0.7)'; ctx.beginPath(); ctx.arc(cx, cy + 36 * k, 5 * k, 0, 7); ctx.fill();
    };
    motif(S / 4, S / 4, 1); motif(S * 0.75, S * 0.75, 1); motif(S * 0.75, S / 4, 0.55); motif(S / 4, S * 0.75, 0.55);
    ctx.strokeStyle = 'rgba(214,170,78,0.14)'; ctx.lineWidth = 1.5;
    for (let i = -S; i < S * 2; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + S, S); ctx.moveTo(i, S); ctx.lineTo(i + S, 0); ctx.stroke(); }
    noise(ctx, S, S, 7);
  },
  // raised lacquer panel with a gold inset line (wainscoting, doors)
  panel(ctx, S) {
    ctx.fillStyle = '#17261f'; ctx.fillRect(0, 0, S, S);
    const m = 20;
    const g = ctx.createLinearGradient(m, m, S - m, S - m); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g; ctx.fillRect(m, m, S - 2 * m, S - 2 * m);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 4; ctx.strokeRect(m, m, S - 2 * m, S - 2 * m);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2; ctx.strokeRect(m + 2, m + 2, S - 2 * m - 4, S - 2 * m - 4);
    ctx.strokeStyle = 'rgba(218,172,80,0.95)'; ctx.lineWidth = 2.5; ctx.strokeRect(m + 14, m + 14, S - 2 * m - 28, S - 2 * m - 28);
    noise(ctx, S, S, 6);
  },
  // cream plaster ceiling coffer
  coffer(ctx, S) {
    ctx.fillStyle = '#e8dcc3'; ctx.fillRect(0, 0, S, S);
    const m = 26;
    const g = ctx.createLinearGradient(m, m, S - m, S - m); g.addColorStop(0, 'rgba(90,70,40,0.35)'); g.addColorStop(0.5, 'rgba(90,70,40,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0.25)');
    ctx.fillStyle = g; ctx.fillRect(m, m, S - 2 * m, S - 2 * m);
    ctx.strokeStyle = 'rgba(120,95,55,0.7)'; ctx.lineWidth = 4; ctx.strokeRect(m, m, S - 2 * m, S - 2 * m);
    ctx.strokeStyle = 'rgba(214,170,78,0.9)'; ctx.lineWidth = 2.5; ctx.strokeRect(m - 8, m - 8, S - 2 * m + 16, S - 2 * m + 16);
    ctx.fillStyle = 'rgba(214,170,78,0.85)'; ctx.beginPath(); ctx.arc(S / 2, S / 2, 9, 0, 7); ctx.fill();
    noise(ctx, S, S, 5);
  },
  // tufted leather (tint with the material colour)
  leather(ctx, S) {
    ctx.fillStyle = '#d9d9d9'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; ctx.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5); }
    const n = 4, c = S / n;
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 3;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const x = i * c, y = j * c;
      if (i < n && j < n) { ctx.beginPath(); ctx.moveTo(x + c / 2, y); ctx.lineTo(x + c, y + c / 2); ctx.lineTo(x + c / 2, y + c); ctx.lineTo(x, y + c / 2); ctx.closePath(); ctx.stroke(); }
    }
    const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S * 0.7); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(40,30,20,0.85)';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.beginPath(); ctx.arc(i * c + c / 2, j * c + c / 2, 4, 0, 7); ctx.fill(); }
  },
  // brushed brass (elevator doors)
  brass(ctx, S) {
    ctx.fillStyle = '#c59a48'; ctx.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 2) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,235,170' : '70,45,10'},${Math.random() * 0.12})`; ctx.fillRect(x, 0, 2, S); }
    ctx.strokeStyle = 'rgba(60,38,8,0.6)'; ctx.lineWidth = 4; ctx.strokeRect(14, 14, S - 28, S - 28);
    ctx.strokeStyle = 'rgba(255,240,190,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(18, 18, S - 36, S - 36);
    noise(ctx, S, S, 6);
  },
  // walnut planks (desks, elevator cars)
  wood(ctx, S) {
    ctx.fillStyle = '#5a3822'; ctx.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 64) {
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,200,140' : '0,0,0'},${0.04 + Math.random() * 0.08})`; ctx.fillRect(x, 0, 62, S);
      for (let k = 0; k < 14; k++) { ctx.strokeStyle = `rgba(30,15,5,${0.1 + Math.random() * 0.25})`; ctx.lineWidth = 0.6 + Math.random() * 1.2; ctx.beginPath(); const px = x + 4 + Math.random() * 54; ctx.moveTo(px, 0); ctx.bezierCurveTo(px + 6, S * 0.3, px - 6, S * 0.7, px + 2, S); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 62, 0, 2, S);
    }
    noise(ctx, S, S, 8);
  },
  // sun-bleached stone / pastel island rock
  stone(ctx, S) {
    ctx.fillStyle = '#e7d9cb'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '90,60,50' : '255,255,255'},${Math.random() * 0.1})`; ctx.beginPath(); ctx.arc(Math.random() * S, Math.random() * S, 3 + Math.random() * 14, 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(90,60,60,0.45)'; ctx.lineWidth = 5; ctx.strokeRect(2.5, 2.5, S - 5, S - 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(8, 8, S - 16, S - 16);
    noise(ctx, S, S, 12);
  },
};

const texCache = new Map();
export function getTexture(name) {
  if (texCache.has(name)) return texCache.get(name);
  const S = 256;
  const [c, ctx] = canvas(S, S);
  (TEX_BUILDERS[name] || TEX_BUILDERS.tile)(ctx, S);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  texCache.set(name, t);
  return t;
}

const matCache = new Map();
/** Surface material. `tex` picks the pattern; `color` tints it; `emissive` gives it a glow. */
export function surfaceMaterial({ tex = 'tile', color = 0xffffff, emissive = 0x000000, emissiveIntensity = 1, roughness = 0.62, metalness = 0.05 } = {}) {
  const key = [tex, color, emissive, emissiveIntensity, roughness, metalness].join('|');
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ map: getTexture(tex), color, emissive, emissiveIntensity, roughness, metalness });
  matCache.set(key, m);
  return m;
}

const plainCache = new Map();
/** Flat colour (optionally glowing) material for trims, hazards, poles, etc. */
export function plainMaterial(color, { emissive = 0x000000, emissiveIntensity = 0, roughness = 0.5, metalness = 0, transparent = false, opacity = 1 } = {}) {
  const key = [color, emissive, emissiveIntensity, roughness, metalness, transparent, opacity].join('|');
  if (plainCache.has(key)) return plainCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness, metalness, transparent, opacity });
  plainCache.set(key, m);
  return m;
}

/** A glowing material that ignores lighting (blooms nicely when `intensity` > 1). */
export function glowMaterial(color, intensity = 1.6, opacity = 1) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false, transparent: opacity < 1, opacity });
  return m;
}

const geoCache = new Map();
/** Rounded box whose UVs are world-scaled so textures tile at TILE metres regardless of box size. */
export function boxGeometry(w, h, d, radius = 0.08) {
  const key = [w, h, d, radius].map((n) => +n.toFixed(3)).join('|');
  if (geoCache.has(key)) return geoCache.get(key);
  const r = Math.max(0.001, Math.min(radius, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const g = new RoundedBoxGeometry(w, h, d, 2, r);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i) + w / 2, y = pos.getY(i) + h / 2, z = pos.getZ(i) + d / 2;
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; } else if (nx >= nz) { u = z; v = y; } else { u = x; v = y; }
    uv.setXY(i, u / TILE, v / TILE);
  }
  uv.needsUpdate = true;
  geoCache.set(key, g);
  return g;
}

const edgeCache = new Map();
export function edgeGeometry(w, h, d) {
  const key = [w, h, d].map((n) => +n.toFixed(3)).join('|');
  if (edgeCache.has(key)) return edgeCache.get(key);
  const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
  edgeCache.set(key, g);
  return g;
}

// ---- text, sprites ----------------------------------------------------------------------------

/** Canvas text texture for in-world signs. Fonts must already be loaded. */
export function textTexture(text, {
  w = 512, h = 128, font = '"Archivo Black", Impact, sans-serif', size = 0,
  color = '#ffffff', bg = null, stroke = null, strokeWidth = 0, border = null, align = 'center', padding = 24, glow = null,
} = {}) {
  const [c, ctx] = canvas(w, h);
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 8; ctx.strokeRect(6, 6, w - 12, h - 12); }
  const lines = String(text).split('\n');
  let fs = size || Math.floor((h - padding * 2) / lines.length);
  ctx.textBaseline = 'middle'; ctx.textAlign = align;
  // shrink to fit width
  for (;;) {
    ctx.font = `${fs}px ${font}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest <= w - padding * 2 || fs < 12) break;
    fs -= 2;
  }
  const lh = fs * 1.08;
  const x = align === 'center' ? w / 2 : align === 'left' ? padding : w - padding;
  lines.forEach((l, i) => {
    const y = h / 2 + (i - (lines.length - 1) / 2) * lh;
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 18; }
    if (stroke) { ctx.lineWidth = strokeWidth || fs / 8; ctx.strokeStyle = stroke; ctx.strokeText(l, x, y); }
    ctx.fillStyle = color; ctx.fillText(l, x, y);
    ctx.shadowBlur = 0;
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const spriteCache = new Map();
export function softTexture(kind = 'puff') {
  if (spriteCache.has(kind)) return spriteCache.get(kind);
  const S = 128;
  const [c, ctx] = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  if (kind === 'shadow') { g.addColorStop(0, 'rgba(0,0,0,0.65)'); g.addColorStop(0.55, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); }
  else if (kind === 'glow') { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
  else { g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  spriteCache.set(kind, t);
  return t;
}
