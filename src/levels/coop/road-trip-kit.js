import * as THREE from 'three';
import { glowMaterial, plainMaterial } from '../../engine/materials.js';

// Session 12 helpers (Road Trip): lanes, telegraphed road hazards that register themselves for the navigator's map,
// the map/dashboard canvases and road markings. Everything here is local scenery + hazard volumes driven by the
// world clock or by the shared car state `R` (see road-trip.js), so both machines agree.

export const LANE_X = [-7, 0, 7];                    // lane -1 / 0 / +1
export const laneX = (l) => LANE_X[l + 1];
export const CAR = { w: 4.8, d: 6.5, h: 1.0 };       // the car is a 1 m thick moving platform sitting on the road (top at y = 1)
export const ROAD_W = 26;                            // x -13 … 13
export const LETHAL = 0.2;                           // an arm is dangerous while its openness is below this

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

/** Openness 0..1 of a barrier arm in a repeating cycle: opens quickly, stays up, then comes down over `rampDown` s (amber) and stays down. */
export function cycle(t, { period = 9, open = 5.2, offset = 0, rampUp = 0.35, rampDown = 1.2 } = {}) {
  const ph = (((t + offset) % period) + period) % period;
  if (ph < rampUp) return ph / rampUp;
  if (ph < open - rampDown) return 1;
  if (ph < open) return (open - ph) / rampDown;
  return 0;
}

const hazardBox = (w, o) => {
  const h = w.hazard({ ...o });
  h.group.visible = false;                            // the visible part is built separately; this is only the volume
  return h;
};

/** Dashed lane lines + solid edge lines for one stretch of road (instanced). */
export function roadMarks(w, z0, z1, { skip = [] } = {}) {
  const len = Math.abs(z1 - z0), zm = (z0 + z1) / 2;
  const mk = (x, y, z, dw, dh, dd, color) => { const m = w.box({ x, y, z, w: dw, h: dh, d: dd, color, emissive: color, shadow: false, radius: 0.01 }); return m; };
  for (const x of [-12.4, 12.4]) mk(x, 0.03, zm, 0.22, 0.05, len, 0xf2f0e4);
  const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.05, 2.4), plainMaterial(0xf2f0e4, { emissive: 0xf2f0e4, emissiveIntensity: 0.5 }), Math.ceil(len / 6) * 2);
  const m4 = new THREE.Matrix4(); let n = 0;
  for (const x of [-3.5, 3.5]) for (let z = Math.max(z0, z1) - 3; z > Math.min(z0, z1) + 2; z -= 6) {
    if (skip.some(([a, b, sx]) => z <= a && z >= b && (sx === undefined || sx === x))) continue;
    m4.setPosition(x, 0.03, z); dash.setMatrixAt(n++, m4);
  }
  dash.count = n; dash.instanceMatrix.needsUpdate = true; dash.frustumCulled = false;
  w.add(dash);
}

/** Orange traffic-cone triple across one lane. Always lethal, but flashes hard as the car comes up on it. */
export function cones(w, R, items, lanes, z) {
  for (const lane of [].concat(lanes)) {
    const x = laneX(lane);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 0.15, roughness: 0.5 });
    const white = plainMaterial(0xf4f4f4, { roughness: 0.6 });
    const g = new THREE.Group(); g.position.set(x, 0, z);
    for (const dx of [-1.6, 0, 1.6]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.25, 14), mat); cone.position.set(dx, 0.7, 0); cone.castShadow = true; g.add(cone);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.34, 0.2, 14), white); band.position.set(dx, 0.6, 0); g.add(band);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.1), plainMaterial(0x23262e)); base.position.set(dx, 0.04, 0); g.add(base);
    }
    w.add(g);
    const hz = hazardBox(w, { x, y: 1.5, z, w: 4.6, h: 2.2, d: 1.2 });
    items.push({ kind: 'cone', x, z, hw: 2.3, hd: 0.6 });
    w.updaters.push(() => {
      const d = R.z - z;                                         // metres ahead of the car
      const live = d > -5 && d < 52;
      const fast = d < 24 ? 16 : 9;
      mat.emissiveIntensity = live ? (Math.sin(w.t * fast) > 0 ? 1.7 : 0.1) : 0.15;
    });
    void hz;
  }
}

/** A barrier arm over (part of) the road. `a(t)` gives its openness 0..1; it only hurts while nearly shut (LETHAL). */
export function arm(w, R, items, { x, z, width, side = 1, a, label = null }) {
  const px = x - side * width / 2;                                 // hinge post
  const g = new THREE.Group(); g.position.set(px, 0, z); w.add(g);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.9, 0.6), plainMaterial(0x2b2f3a, { metalness: 0.4, roughness: 0.5 })); post.position.set(0, 0.95, 0); g.add(post);
  const lampMat = glowMaterial(0xff3040, 2.2);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), lampMat); lamp.position.set(0, 2.2, 0); g.add(lamp);
  const pivot = new THREE.Group(); pivot.position.set(0, 1.5, 0); g.add(pivot);
  const segs = Math.max(4, Math.round(width / 1.2)), sl = (width - 0.3) / segs;
  for (let i = 0; i < segs; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sl, 0.34, 0.34), plainMaterial(i % 2 ? 0xf6f6f6 : 0xe23b3b, { roughness: 0.5, emissive: i % 2 ? 0x222222 : 0x300808, emissiveIntensity: 0.6 }));
    m.position.set(side * (0.3 + sl * (i + 0.5)), 0, 0); pivot.add(m);
  }
  const hz = hazardBox(w, { x, y: 1.6, z, w: width, h: 2.7, d: 0.9 });
  const item = { kind: 'arm', x, z, hw: width / 2, hd: 0.45, a: 0, f: a, label };
  items.push(item);
  w.updaters.push(() => {
    const v = a(w.t);
    item.a = v;
    pivot.rotation.z = side * v * 1.25;
    hz.enabled = v < LETHAL;
    const d = R.z - z, near = d > -4 && d < 46;
    const col = v >= 0.99 ? 0x39e08a : v < LETHAL ? 0xff3040 : 0xffb020;
    lampMat.color.setHex(col).multiplyScalar(near && v < 0.99 && Math.sin(w.t * 12) < 0 ? 0.35 : 2.2);
  });
  return item;
}

/** A railway level crossing across the whole road (two half arms) with a silent train that fills the shut window. */
export function crossing(w, R, items, z, p = { period: 12, open: 8, offset: 0, rampDown: 1.5 }) {
  const a = (t) => cycle(t, p);
  arm(w, R, items, { x: -6.5, z, width: 13, side: 1, a, label: 'CROSSING' });
  arm(w, R, items, { x: 6.5, z, width: 13, side: -1, a });
  const train = new THREE.Group(); w.add(train);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(34, 3.4, 2.6), plainMaterial(0x4a5568, { metalness: 0.4, roughness: 0.5 })); hull.position.y = 2.1; train.add(hull);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(34.1, 0.4, 2.7), plainMaterial(0xe23b3b, { emissive: 0x501010, emissiveIntensity: 0.8 })); stripe.position.y = 2.3; train.add(stripe);
  train.position.z = z;
  const shut = p.period - p.open;
  w.updaters.push(() => {
    const ph = (((w.t + p.offset) % p.period) + p.period) % p.period;
    const tc = ph - p.open;
    train.visible = tc > 0.1;
    if (train.visible) train.position.x = -52 + (tc / shut) * 104;
  });
  for (const sx of [-14.6, 14.6]) {                                   // crossbuck sign
    const s = w.sign({ text: 'CROSSING', x: sx, y: 4.6, z: z + 0.3, w: 3.2, h: 0.9, glow: true, color: '#ffffff', bg: 'rgba(200,30,40,0.92)', border: '#ffffff', tw: 512 });
    void s;
  }
}

/** A low gantry: lethal for anyone standing on the car, clear for anyone standing on the (lower) trailer. */
export function lowBridge(w, R, items, z) {
  const y0 = 2.4, y1 = 4.3;
  const g = new THREE.Group(); g.position.set(0, 0, z); w.add(g);
  const beamMat = plainMaterial(0x2b2f3a, { metalness: 0.4, roughness: 0.5 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 3, y1 - y0, 2.0), beamMat); beam.position.y = (y0 + y1) / 2; g.add(beam);
  for (const sx of [-14.2, 14.2]) { const pil = new THREE.Mesh(new THREE.BoxGeometry(1.2, y1, 2.0), beamMat); pil.position.set(sx, y1 / 2, 0); g.add(pil); }
  const lampMats = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 2.06), plainMaterial(i % 2 ? 0xffc83d : 0x1c1e26));
    m.position.set(-12 + i * 3, y0 - 0.1, 0); g.add(m);
  }
  for (const lx of [-9, -3, 3, 9]) { const mt = glowMaterial(0xffb020, 2.2); lampMats.push(mt); const l = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), mt); l.position.set(lx, y1 + 0.35, 1.2); g.add(l); }
  w.sign({ text: 'LOW BRIDGE · 2.4 M\nCAR ROOF: DUCK DOWN TO THE TRAILER', x: 0, y: y1 + 2.0, z: z + 1.3, w: 11, h: 2.0, glow: true, color: '#ffe9a8', bg: 'rgba(20,16,12,0.85)', border: '#ffc83d', tw: 900 });
  hazardBox(w, { x: 0, y: (y0 + y1) / 2, z, w: ROAD_W + 3, h: y1 - y0, d: 2.0 });
  items.push({ kind: 'low', x: 0, z, hw: 13, hd: 1 });
  w.updaters.push(() => {
    const d = R.z - z, near = d > -12 && d < 60;
    const on = near && Math.sin(w.t * (d < 26 ? 12 : 7)) > 0;
    for (const mt of lampMats) mt.color.setHex(0xffb020).multiplyScalar(on ? 2.6 : 0.25);
  });
}

/** A solid-looking striped barrier with a lethal volume (bridge out / road closed / median). Scenery only, it never collides with the car. */
export function block(w, R, items, { x, z, width, depth = 1.2, h = 2.8, label, color = 0xe23b3b, flash = true, kind = 'block', sign: sgn = null }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); w.add(g);
  const mat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
  const segs = Math.max(2, Math.round(width / 1.5)), sl = width / segs;
  const mats = [];
  for (let i = 0; i < segs; i++) {
    const mt = new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf2f2f2 : color, emissive: color, emissiveIntensity: 0.1, roughness: 0.55 });
    mats.push(mt);
    const m = new THREE.Mesh(new THREE.BoxGeometry(sl, h, depth), mt); m.position.set(-width / 2 + sl * (i + 0.5), h / 2, 0); m.castShadow = true; g.add(m);
  }
  void mat;
  hazardBox(w, { x, y: h / 2 + 0.1, z, w: width, h: h + 0.2, d: depth });
  items.push({ kind, x, z, hw: width / 2, hd: depth / 2, label });
  if (sgn) w.sign({ text: sgn, x, y: h + 2.2, z: z + depth / 2 + 0.3, w: Math.min(width, 9), h: 1.8, glow: true, color: '#ffffff', bg: 'rgba(200,30,40,0.92)', border: '#ffffff', tw: 800 });
  if (flash) w.updaters.push(() => {
    const d = R.z - z, near = d > -6 && d < 50;
    const on = near && Math.sin(w.t * (d < 24 ? 14 : 8)) > 0;
    mats.forEach((mt, i) => { mt.emissiveIntensity = i % 2 ? 0.05 : on ? 1.6 : 0.1; });
  });
}

// ------------------------------------------------------------------------------------------------------------------
//  The navigator's map board and the driver's dashboard (canvas textures, redrawn a few times a second)
// ------------------------------------------------------------------------------------------------------------------
const canvasTex = (cw, ch) => {
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { c, ctx: c.getContext('2d'), tex };
};

export function mapBoard(w, R, items, { width = 4.0, height = 2.5 } = {}) {
  const { c, ctx, tex } = canvasTex(640, 400);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
  const AHEAD = 62, BEHIND = 12, X0 = 40, W = 640, H = 400, top = 56, bot = H - 14;
  const sY = (bot - top) / (AHEAD + BEHIND), carY = bot - BEHIND * sY, sX = (W - 2 * X0) / 30;
  const mx = (x) => W / 2 + x * sX, my = (z) => carY - (R.z - z) * sY;
  const col = { cone: '#ff8a2a', block: '#ff4d5e', low: '#ffc83d', kerb: '#4aa8ff' };
  let acc = 0;
  const draw = () => {
    ctx.fillStyle = '#0d111b'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1b2233'; ctx.fillRect(0, 0, W, 44);
    ctx.fillStyle = '#9fe8ff'; ctx.font = '700 26px Inter, system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText('SAT-NAV · NAVIGATOR', 14, 24);
    const laneName = ['LEFT', 'CENTRE', 'RIGHT'][R.lane + 1];
    ctx.textAlign = 'right'; ctx.fillStyle = R.brake ? '#ff6a78' : '#9bf0c1';
    ctx.fillText(`${laneName}${R.brake ? ' · BRAKE' : ''}`, W - 14, 24);
    if (R.noSignal) {
      for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(160,170,190,${Math.random() * 0.5})`; ctx.fillRect(Math.random() * W, 44 + Math.random() * (H - 44), 6 + Math.random() * 40, 3); }
      ctx.fillStyle = 'rgba(8,10,16,0.75)'; ctx.fillRect(40, 130, W - 80, 130);
      ctx.fillStyle = '#ffc83d'; ctx.textAlign = 'center'; ctx.font = '700 44px Inter, system-ui, sans-serif'; ctx.fillText('NO SIGNAL', W / 2, 172);
      ctx.fillStyle = '#e8ecf5'; ctx.font = '600 26px Inter, system-ui, sans-serif'; ctx.fillText('RECALCULATING… READ THE SIGNS', W / 2, 224);
      tex.needsUpdate = true; return;
    }
    ctx.fillStyle = '#242b3b'; ctx.fillRect(mx(-13), top, 26 * sX, bot - top);
    ctx.strokeStyle = '#59627a'; ctx.setLineDash([12, 12]); ctx.lineWidth = 2;
    for (const x of [-3.5, 3.5]) { ctx.beginPath(); ctx.moveTo(mx(x), top); ctx.lineTo(mx(x), bot); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.fillStyle = '#59627a'; ctx.font = '600 20px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
    for (const [l, n] of [[-1, 'L'], [0, 'C'], [1, 'R']]) ctx.fillText(n, mx(laneX(l)), top + 12);
    for (const it of items) {
      const dz = R.z - it.z;
      if (dz < -BEHIND - 4 || dz > AHEAD + 4) continue;
      const y = my(it.z);
      if (it.kind === 'arm') {
        const open = it.a >= 0.99, shut = it.a < LETHAL;
        ctx.fillStyle = open ? '#39e08a' : shut ? '#ff4d5e' : '#ffb020';
        ctx.fillRect(mx(it.x - it.hw), y - 5, it.hw * 2 * sX, 10);
      } else if (it.kind === 'cone') {
        ctx.fillStyle = col.cone;
        for (const dx of [-1.6, 0, 1.6]) { ctx.beginPath(); ctx.moveTo(mx(it.x + dx), y - 9); ctx.lineTo(mx(it.x + dx) - 8, y + 7); ctx.lineTo(mx(it.x + dx) + 8, y + 7); ctx.fill(); }
      } else if (it.kind === 'low') {
        ctx.fillStyle = col.low; ctx.fillRect(mx(-13), y - 6, 26 * sX, 12);
        ctx.fillStyle = '#12151d'; for (let i = 0; i < 12; i++) ctx.fillRect(mx(-13) + i * 40 + 12, y - 6, 14, 12);
      } else {
        ctx.fillStyle = it.kind === 'kerb' ? col.kerb : col.block;
        ctx.fillRect(mx(it.x - it.hw), y - Math.max(5, (it.hd || 0.6) * sY), it.hw * 2 * sX, Math.max(10, (it.hd || 0.6) * 2 * sY));
        if (it.label) { ctx.fillStyle = '#fff'; ctx.font = '600 18px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(it.label, mx(it.x), y - 14); }
      }
    }
    if (R.chOn) {                                        // the van behind us
      const y = my(R.chZ);
      if (y < bot + 30) { ctx.fillStyle = '#ff4d5e'; ctx.fillRect(mx(R.x) - 24, Math.min(y, bot) - 3, 48, 26); }
      ctx.fillStyle = '#ff9aa6'; ctx.textAlign = 'left'; ctx.font = '700 22px Inter, system-ui, sans-serif';
      ctx.fillText(`VAN ${Math.max(0, R.gap).toFixed(0)} m behind`, 14, H - 24);
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(mx(R.x) - 2.4 * sX, carY - 3.25 * sY, 4.8 * sX, 6.5 * sY);
    ctx.fillStyle = '#d0443a'; ctx.fillRect(mx(R.x) - 2.4 * sX + 3, carY - 3.25 * sY + 3, 4.8 * sX - 6, 6.5 * sY - 6);
    if (R.trailerOn) { ctx.fillStyle = '#9aa3b8'; ctx.fillRect(mx(R.x) - 2.4 * sX, carY + 4.6 * sY, 4.8 * sX, 4 * sY); }
    tex.needsUpdate = true;
  };
  return { mesh, draw, tick(dt) { acc += dt; if (acc > 0.12) { acc = 0; if (mesh.visible) draw(); } } };
}

export function dashboard(w, R, driverRole, { width = 15, height = 2.7 } = {}) {
  const { c, ctx, tex } = canvasTex(1024, 190);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
  let key = '';
  const draw = (force) => {
    const k = `${R.lane}|${R.brake}|${R.mode}|${R.sec}|${R.v < 0.2}`;
    if (!force && k === key) return; key = k;
    const W = 1024, H = 190;
    ctx.fillStyle = '#10131c'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#ffc83d'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const fit = (txt, y, px, colr, maxW) => { let f = px; ctx.fillStyle = colr; do { ctx.font = `700 ${f}px Inter, system-ui, sans-serif`; f -= 2; } while (ctx.measureText(txt).width > maxW && f > 12); ctx.fillText(txt, W / 2, y); };
    fit('DASHBOARD · THE ROAD AHEAD IS NOT YOUR DEPARTMENT', 36, 34, '#ffe9a8', W - 60);
    const cell = (cx, cw, label, on, colr) => {
      ctx.fillStyle = on ? colr : '#1f2433'; ctx.fillRect(cx - cw / 2, 68, cw, 62);
      ctx.fillStyle = on ? '#10131c' : '#6b738a'; ctx.font = '700 34px Inter, system-ui, sans-serif'; ctx.fillText(label, cx, 100);
    };
    cell(150, 200, 'LEFT', R.lane === -1, '#39d7c9'); cell(380, 200, 'CENTRE', R.lane === 0, '#39d7c9'); cell(610, 200, 'RIGHT', R.lane === 1, '#39d7c9');
    cell(860, 240, 'BRAKE', R.brake, '#ff6a78');
    fit('STAND ON A LANE PEDAL TO STEER · STAND ON BRAKE TO STOP · LISTEN TO YOUR NAVIGATOR', 160, 24, '#9aa3b8', W - 60);
    tex.needsUpdate = true;
  };
  return { mesh, draw };
}

/** A faint cat's-eye stud (always visible, even in the dark). */
export function stud(w, x, y, z, color = 0xfff1b0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 10), glowMaterial(color, 2.0));
  m.position.set(x, y + 0.05, z); w.add(m); return m;
}

export const css = hex;
