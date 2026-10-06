import * as THREE from 'three';
import { plainMaterial, glowMaterial, softTexture } from '../../engine/materials.js';
import { citySkyline, hotelHalo, GOLD } from './kit.js';

// Hotel level 15 — "Window Ledge" (Hard · Guest Rooms). Outside the hotel, eleven floors up, in a thunderstorm. You are going window
// to window along the stone ledges: a wide sill, a narrow cornice, air conditioners to climb, crumbling sills, a pipe to balance
// on, and a window-cleaner's gondola. The wind pushes you off the wall in gusts (lean into the wall: the D key while you face right).

const Y0 = 14;
const rnd = (n) => Math.floor(Math.random() * n);

export default {
  id: 'hotel-15',
  name: 'Window Ledge',
  music: 'hotel_storm',
  completeQuip: 'You climbed through the open window. The room is the housekeeping closet. Somebody is going to be furious. Not at you. At the weather.',

  build(w, game) {
    w.env({
      top: 0x04050e, horizon: 0x1c2438, bottom: 0x06070d,
      fog: { color: 0x141a2a, near: 40, far: 210 },
      sun: { color: 0x9db4ff, intensity: 0.5, dir: [-0.4, 0.8, 0.5], shadow: false },
      hemi: { sky: 0x8aa0d8, ground: 0x3a3a50, intensity: 0.7 },
      exposure: 0.95, stars: 0.2,
      clouds: { count: 30, color: 0x3a4258, y: [10, 70], radius: [60, 260], opacity: 0.55, size: [40, 110] },
      bloom: { strength: 0.5, radius: 0.7, threshold: 0.95 },
      motes: { color: 0xaec4ff, count: 100, size: 0.06, opacity: 0.35 },
    });
    w.setTheme({ tex: 'stone', color: 0xd6cfc0, trim: null, edge: null, edgeOpacity: 0, roughness: 0.75, metalness: 0, accent: GOLD, danger: 0xff2d4d, rock: 0x555566 });
    w.spawn = { x: 0, y: Y0, z: -0.9, yaw: -Math.PI / 2 };
    w.respawn = { ...w.spawn };
    w.killY = Y0 - 46;
    citySkyline(w);

    // ---- the building ---------------------------------------------------------------------------------------------------------------
    const X0 = -26, X1 = 190, WALLH = 90;
    w.plat({ x: (X0 + X1) / 2, y: Y0 + 70, z: 3.5, w: X1 - X0, d: 7, h: 124, tex: 'stone', color: 0xe8e0d0, roughness: 0.8 });
    // lit / unlit windows (instanced)
    const winGeo = new THREE.BoxGeometry(1.5, 2.3, 0.12);
    const cols = Math.floor((X1 - X0) / 4.4), rows = 24;
    const litM = new THREE.InstancedMesh(winGeo, glowMaterial(0xffc878, 1.1), cols * rows), darkM = new THREE.InstancedMesh(winGeo, plainMaterial(0x16202e, { roughness: 0.15, metalness: 0.4 }), cols * rows);
    const m4 = new THREE.Matrix4(); let li = 0, di = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = X0 + 3 + c * 4.4, y = Y0 - 36 + r * 4.6;
      if (Math.abs(y - (Y0 + 1.4)) < 2.7 && x > -4 && x < X1 - 20) continue;       // the windows we climb along are drawn separately
      m4.makeTranslation(x, y, -0.04);
      if (Math.random() < 0.34) litM.setMatrixAt(li++, m4); else darkM.setMatrixAt(di++, m4);
    }
    litM.count = li; darkM.count = di; litM.instanceMatrix.needsUpdate = darkM.instanceMatrix.needsUpdate = true; w.add(litM); w.add(darkM);
    // string courses
    for (let y = Y0 - 36; y < Y0 + 50; y += 4.6) w.box({ x: (X0 + X1) / 2, y: y - 1.9, z: -0.08, w: X1 - X0, h: 0.22, d: 0.2, color: 0xcfc6b4, rough: 0.8, shadow: false });

    // ---- the route ---------------------------------------------------------------------------------------------------------------------
    // [type, length along the wall, gap before, rise, depth]
    const SPEC = [
      ['wide', 6, 0, 0, 1.6], ['wide', 4, 2.6, 0, 1.6], ['cornice', 8, 2.4, 0, 0.95],
      ['ac', 1.7, 2.9, 0.9, 1.5], ['ac', 1.7, 2.7, 0.9, 1.5], ['wide', 4.5, 2.6, 0.8, 1.6],
      ['crumble', 1.9, 2.5, 0.5, 1.3], ['crumble', 1.9, 2.5, 0.5, 1.3], ['crumble', 1.9, 2.5, 0.5, 1.3],
      ['pipe', 8, 2.7, 0.0, 0.6], ['wide', 4.5, 2.6, 0.0, 1.6],
      ['gondola', 0, 9.6, 0.0, 0], ['wide', 5, 0, 0, 1.6],
      ['ac', 1.7, 2.8, 1.0, 1.5], ['ac', 1.7, 2.7, 1.0, 1.5], ['ac', 1.7, 2.7, 1.0, 1.5],
      ['cornice', 9, 2.4, 0.8, 0.95], ['crumble', 1.9, 2.5, 0.5, 1.3], ['crumble', 1.9, 2.5, 0.5, 1.3], ['crumble', 1.9, 2.5, 0.5, 1.3],
      ['wide', 4.5, 2.6, 0.8, 1.6], ['perch', 1.3, 3.0, 0.4, 1.2], ['perch', 1.3, 3.1, 0.4, 1.2], ['perch', 1.3, 3.1, 0.4, 1.2], ['wide', 7, 2.9, 0.4, 1.6],
    ];
    const path = (p) => { p.o.path = true; return p; };
    let x = -3, y = Y0;
    const ledges = [];
    const gondolas = [];
    const mats = { wide: { tex: 'stone', color: 0xd6cfc0 }, cornice: { tex: 'stone', color: 0xc8c0b0 }, ac: { tex: 'metal', color: 0xbfc6d0 }, crumble: { tex: 'stone', color: 0xb8a890 }, pipe: { tex: 'metal', color: 0x8a8d95 }, perch: { tex: 'stone', color: 0x9a9488 } };
    SPEC.forEach(([type, len, gap, rise, dep], i) => {
      x += gap; y += rise;
      if (type === 'gondola') {
        // a window-cleaner's gondola riding a rail: it swings between the two ledges
        const gx = x - gap / 2 + 0, gapC = x - gap + gap / 2;
        void gx;
        const pl = path(w.plat({ x: gapC, y, z: -1.7, w: 4.4, d: 2.4, h: 0.3, tex: 'metal', color: 0xd8dce4, roughness: 0.3, metalness: 0.8, radius: 0.04 }));
        const A = (gap - 4.4) / 2 - 0.6;
        w.mover(pl, (t) => ({ x: Math.sin(t * 1.15) * A }));
        // rail, cables, railing (they ride along)
        for (const sx of [-1, 1]) pl.attach(w.box({ x: gapC + sx * 2.0, y: y + 14, z: -1.7, w: 0.06, h: 28, d: 0.06, color: 0x2a2a30, metal: 0.8, rough: 0.5, static: false }));
        pl.attach(w.box({ x: gapC, y: y + 0.55, z: -2.8, w: 4.4, h: 0.07, d: 0.07, color: 0xffd21f, rough: 0.5, static: false }));
        for (const sx of [-1, 1]) pl.attach(w.box({ x: gapC + sx * 2.15, y: y + 0.55, z: -1.7, w: 0.07, h: 0.07, d: 2.4, color: 0xffd21f, rough: 0.5, static: false }));
        w.box({ x: gapC, y: y + 28.5, z: -1.7, w: gap + 8, h: 0.5, d: 0.5, color: 0x3a3a44, metal: 0.8, rough: 0.5, shadow: false });
        ledges.push({ i, type, pl, x: gapC, y, len: 4.4 });
        x += 0;   // the next ledge starts after the gap
        return;
      }
      const cx = x + len / 2, m = mats[type];
      const zc = -dep / 2;
      const h = type === 'ac' ? 1.2 : type === 'pipe' ? 0.6 : type === 'perch' ? 0.8 : 0.5;
      const pl = path(w.plat({ x: cx, y, z: zc, w: len, d: dep, h, tex: m.tex, color: m.color, roughness: type === 'pipe' ? 0.3 : 0.75, metalness: type === 'pipe' || type === 'ac' ? 0.6 : 0, radius: type === 'pipe' ? 0.25 : 0.05, trim: type === 'pipe' ? undefined : 0x8aa4d0 }));
      if (type === 'crumble') w.crumble(pl, { delay: 0.5, gone: 3.2 });
      ledges.push({ i, type, pl, x: cx, y, len, dep });
      // dressing under/around
      if (type === 'ac') { for (let k = 0; k < 3; k++) w.box({ x: cx - 0.5 + k * 0.5, y: y - 0.2, z: zc - 0.77, w: 0.06, h: 0.7, d: 0.05, color: 0x222a34, rough: 0.5, shadow: false }); w.box({ x: cx, y: y + 0.05, z: zc - 0.77, w: 1.5, h: 0.1, d: 0.03, glow: 0x6cf0b2, glowIntensity: 0.9, shadow: false }); }
      if (type === 'perch') { const gar = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 6), plainMaterial(0x6a6458, { roughness: 0.9, flatShading: true })); gar.position.set(cx, y + 0.65, zc + 0.2); w.add(gar); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), plainMaterial(0x6a6458, { roughness: 0.9, flatShading: true })); hd.position.set(cx, y + 1.5, zc - 0.1); w.add(hd); for (const sx of [-1, 1]) { const wing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), plainMaterial(0x6a6458, { roughness: 0.9, flatShading: true })); wing.position.set(cx + sx * 0.7, y + 1.2, zc + 0.3); wing.rotation.z = sx * 0.6; w.add(wing); } }
      if (type === 'pipe') { for (const px of [cx - len / 2 + 0.3, cx + len / 2 - 0.3]) w.box({ x: px, y: y - 0.45, z: -0.25, w: 0.12, h: 0.9, d: 0.5, color: 0x6a6e78, metal: 0.8, rough: 0.4, shadow: false }); }
      x += len;
    });
    // the gondola's far side starts after its gap (SPEC accounted for it: the next 'wide' has gap 0 and starts at x)
    // checkpoints: sills after the first AC pair, after the pipe, after the second crumble run
    const wideIdx = ledges.filter((l) => l.type === 'wide');
    for (const k of [2, 4, 5]) { const l = wideIdx[k]; if (l) w.checkpoint({ x: l.x, y: l.y, z: -0.9, real: true }); }
    // the window we are heading for
    const last = ledges[ledges.length - 1];
    const gx = last.x + last.len / 2 - 1.4;
    w.box({ x: gx, y: last.y + 1.5, z: 0.02, w: 2.4, h: 3.0, d: 0.1, color: 0xffd890, glow: 0xffe0a0, glowIntensity: 1.2, shadow: false });
    hotelHalo(w, gx, last.y + 1.6, -1.2, 7, 0xffc880, 0.5);
    w.sign({ text: 'STAFF CLOSET', x: gx, y: last.y + 3.5, z: -0.06, w: 3.4, h: 0.6, rotY: Math.PI, color: '#ffd21f', double: false, tw: 512, size: 60 });
    w.goal({ x: gx, y: last.y, z: -1.0, color: GOLD, onReach: () => { game.say('hotel.l15.done', { priority: 2 }); game.completeLevel(); } });
    // the start window (open, with a curtain)
    w.box({ x: -2.6, y: Y0 + 1.5, z: 0.02, w: 2.4, h: 3.0, d: 0.1, color: 0xffd890, glow: 0xffe0a0, glowIntensity: 1.0, shadow: false });
    // sills under lit windows along the route (decor only)
    for (const l of ledges) if (l.type === 'wide' || l.type === 'cornice') w.box({ x: l.x, y: l.y + 1.7, z: 0.0, w: Math.min(2.4, l.len - 0.6), h: 2.6, d: 0.12, glow: Math.random() < 0.5 ? 0xffc878 : 0x16202e, glowIntensity: 0.9, shadow: false });

    // ---- wind: gusts along the narrow stretches (push away from the wall) ----------------------------------------------------------------
    const windy = ledges.filter((l) => l.type === 'cornice' || l.type === 'pipe' || (l.type === 'wide' && l.i > 18));
    const winds = windy.map((l, k) => w.wind({ x: l.x, y: l.y + 1.2, z: -0.8, w: l.len + 3, h: 3, d: 4, dx: 0, dz: -1, strength: 12, period: 4.8, on: 1.9, phase: k * 1.7 }));
    let windScale = 1;   // baby mode halves the gusts (tests can also set it)

    // ---- rain + lightning ----------------------------------------------------------------------------------------------------------------------
    const RN = 220, rpos = new Float32Array(RN * 6), rseed = [];
    for (let i = 0; i < RN; i++) rseed.push([Math.random() * 30 - 15, Math.random() * 24, Math.random() * 16 - 12]);
    const rgeo = new THREE.BufferGeometry(); rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
    const rain = new THREE.LineSegments(rgeo, new THREE.LineBasicMaterial({ color: 0xaec4ff, transparent: true, opacity: 0.35 })); rain.frustumCulled = false; w.add(rain);
    let nextBolt = 6 + Math.random() * 6, flash = 0, thunderAt = -1;
    const hemiBase = w.hemi.intensity;
    w.onUpdate((dt, t) => {
      const p = game.player;
      for (const wi of winds) wi.strength = 12 * windScale * (game.baby ? 0.5 : 1);
      for (let i = 0; i < RN; i++) {
        const [sx, sy, sz] = rseed[i];
        const rx = p.x + sx, rz = p.z + sz * 0.5 - 4, ry = p.y + 12 - ((sy + t * 18) % 24);
        rpos[i * 6] = rx; rpos[i * 6 + 1] = ry; rpos[i * 6 + 2] = rz;
        rpos[i * 6 + 3] = rx - 0.12; rpos[i * 6 + 4] = ry - 0.8; rpos[i * 6 + 5] = rz - 0.35;
      }
      rgeo.attributes.position.needsUpdate = true;
      if (t > nextBolt) { nextBolt = t + 7 + Math.random() * 9; flash = 1; thunderAt = t + 0.5 + Math.random() * 1.2; }
      if (flash > 0) { flash = Math.max(0, flash - dt * 5); w.hemi.intensity = hemiBase + flash * 3.2; } else w.hemi.intensity = hemiBase;
      if (thunderAt > 0 && t > thunderAt) { thunderAt = -1; game.audio.rumble(1.6); }
    });

    // ---- the host --------------------------------------------------------------------------------------------------------------------------------------
    let t0 = 0, intro = false; const said = {};
    const once = (k) => { if (said[k]) return; said[k] = true; game.say(`hotel.l15.${k}`, { priority: 1 }); };
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t0 += dt;
      const p = g.player;
      if (!intro && t0 > 1.2) { intro = true; g.say('hotel.l15.intro'); g.say('hotel.l15.intro2'); }
      if (p.x > ledges[2].x - 3) once('wind');
      if (p.x > ledges[3].x - 3) once('ac');
      if (p.x > ledges[6].x - 3) once('crumble');
      if (p.x > ledges[9].x - 3) once('pipe');
      if (p.x > ledges[11].x - 6) once('gondola');
      if (p.x > ledges[21].x - 3) once('gargoyle');
    };
    w.hooks.onDeath = (info) => { if (info.reason !== 'hazard' && Math.random() < 0.7) { game.say('hotel.l15.fall', { priority: 1 }); return true; } return false; };
    w.ledge = { ledges, winds, gondolas, Y0, set windScale(v) { windScale = v; } };
    void rnd; void softTexture;
  },
};
