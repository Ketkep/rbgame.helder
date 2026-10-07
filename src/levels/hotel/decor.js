import * as THREE from 'three';
import { inView } from '../../engine/view.js';
import { L, ELEV_X, GOLD } from './kit.js';

// Look-only gags for the lobby: nothing to press, nothing to listen to, just things that are slightly wrong.
//  · a departures board whose statuses keep changing (and which has opinions about the floors)
//  · a clock whose numbers run backwards
//  · four portraits whose eyes follow you, and whose faces change while you are not looking
//  · an inspection certificate beside every elevator
//  · a wet-floor sign, standing exactly where you will not slip

const FONT = '"Archivo Black", Impact, sans-serif';
const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const canvasTexture = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const rng = (seed) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

export function lobbyDecor(w, game) {
  const own = { tex: [], mat: [], geo: [] };
  const track = (arr, o) => { arr.push(o); return o; };
  const basic = (map, k = 1) => track(own.mat, new THREE.MeshBasicMaterial({ map, color: new THREE.Color(k, k, k), toneMapped: false }));
  const plane = (mat, pw, ph, x, y, z, ry = 0) => { const m = new THREE.Mesh(track(own.geo, new THREE.PlaneGeometry(pw, ph)), mat); m.position.set(x, y, z); m.rotation.y = ry; w.add(m); return m; };
  const frameBox = (x, y, z, pw, ph, ry = 0, th = 0.12) => {          // a gold picture frame around a pw x ph picture
    const g = (bw, bh, ox, oy) => { const m = w.box({ x: x + Math.cos(ry) * ox, y: y + oy, z: z - Math.sin(ry) * ox, w: Math.abs(Math.cos(ry)) > 0.5 ? bw : 0.12, h: bh, d: Math.abs(Math.cos(ry)) > 0.5 ? 0.12 : bw, color: GOLD, metal: 1, rough: 0.3, shadow: false }); return m; };
    g(pw + 2 * th, th, 0, ph / 2 + th / 2); g(pw + 2 * th, th, 0, -ph / 2 - th / 2); g(th, ph, -pw / 2 - th / 2, 0); g(th, ph, pw / 2 + th / 2, 0);
  };

  // ---- departures board (north wall, west of the elevators) --------------------------------------------
  {
    const W = 1024, H = 560, [c, g] = makeCanvas(W, H), tex = track(own.tex, canvasTexture(c));
    const rows = [
      ['FLOOR 1', 'EASY', ['ON TIME', 'ON TIME', 'BOARDING']],
      ['FLOOR 2', 'MEDIUM', ['DELAYED', 'ON TIME', 'DELAYED']],
      ['FLOOR 3', 'HARD', ['CANCELLED', 'DELAYED', 'ON TIME']],
      ['FLOOR 4', 'IMPOSSIBLE', ['LOL', 'NO', 'GOOD LUCK']],
      ['FLOOR 13', '???', ['BOARDING', 'BOARDING', 'DO NOT']],
    ];
    const colour = (s) => (s === 'ON TIME' || s === 'BOARDING' ? '#5cff9a' : s === 'DELAYED' ? '#ffcf4a' : '#ff5a5a');
    const pick = rows.map(() => 0);
    const draw = (flip = -1) => {
      g.fillStyle = '#07070c'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#d8a94a'; g.lineWidth = 8; g.strokeRect(6, 6, W - 12, H - 12);
      g.fillStyle = '#ffb020'; g.font = `60px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('DEPARTURES', 40, 62);
      g.fillStyle = '#9a7a40'; g.font = `26px ${FONT}`; g.textAlign = 'right'; g.fillText('subject to your mood', W - 40, 66);
      rows.forEach((r, i) => {
        const y = 150 + i * 80, status = r[2][pick[i]];
        g.fillStyle = i === flip ? '#1a1a22' : '#0d0d14'; g.fillRect(24, y - 32, W - 48, 64);
        g.font = `44px ${FONT}`; g.textAlign = 'left'; g.fillStyle = '#ffb020'; g.fillText(r[0], 44, y);
        g.fillStyle = '#e8dcc0'; g.fillText(r[1], 290, y);
        g.textAlign = 'right'; g.fillStyle = colour(status); g.fillText(i === flip ? '' : status, W - 44, y);
      });
      tex.needsUpdate = true;
    };
    draw();
    plane(basic(tex, 1.1), 6.6, 3.6, -18, 6.3, L.z0 + 0.12);
    w.box({ x: -18, y: 6.3, z: L.z0 + 0.06, w: 6.9, h: 3.9, d: 0.1, color: 0x0c0c10, rough: 0.4, shadow: false });
    let timer = 3, flipping = -1, flipT = 0;
    w.onUpdate((dt) => {
      if (flipping >= 0) { flipT -= dt; if (flipT <= 0) { pick[flipping] = (pick[flipping] + 1 + Math.floor(Math.random() * 2)) % 3; flipping = -1; draw(); } return; }
      timer -= dt;
      if (timer <= 0) { timer = 2.5 + Math.random() * 4; flipping = Math.floor(Math.random() * rows.length); flipT = 0.35; draw(flipping); }
    });
  }

  // ---- the backwards clock (north wall, east of the elevators) --------------------------------------------
  {
    const S = 512, [c, g] = makeCanvas(S, S), R = S / 2;
    g.fillStyle = '#f4ecd6'; g.beginPath(); g.arc(R, R, R - 4, 0, 7); g.fill();
    g.strokeStyle = '#b8892f'; g.lineWidth = 14; g.beginPath(); g.arc(R, R, R - 10, 0, 7); g.stroke();
    g.fillStyle = '#2a1810'; g.font = '700 62px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let n = 1; n <= 12; n++) { const a = -(n * Math.PI) / 6; g.fillText(String(n), R + Math.sin(a) * (R - 64), R - Math.cos(a) * (R - 64)); }   // counter-clockwise numerals
    for (let k = 0; k < 60; k++) { const a = (k * Math.PI) / 30; g.fillStyle = '#2a1810'; g.fillRect(R + Math.sin(a) * (R - 26) - 1.5, R - Math.cos(a) * (R - 26) - (k % 5 ? 4 : 8), 3, k % 5 ? 8 : 16); }
    const tex = track(own.tex, canvasTexture(c));
    const cx = 18, cy = 7.0, cz = L.z0 + 0.14;
    plane(basic(tex, 1.0), 3.2, 3.2, cx, cy, cz);
    w.box({ x: cx, y: cy, z: cz - 0.06, w: 3.7, h: 3.7, d: 0.1, color: GOLD, metal: 1, rough: 0.3, shadow: false });
    const hand = (len, wid, color) => { const gr = new THREE.Group(); const m = new THREE.Mesh(track(own.geo, new THREE.BoxGeometry(wid, len, 0.03)), track(own.mat, new THREE.MeshBasicMaterial({ color }))); m.position.y = len / 2 - 0.12; gr.add(m); gr.position.set(cx, cy, cz + 0.03 + wid * 0.05); w.add(gr); return gr; };
    const hh = hand(0.85, 0.11, 0x1a0f0a), mh = hand(1.25, 0.08, 0x1a0f0a), sh = hand(1.4, 0.03, 0xb01030);
    const now = new Date(), t0 = (now.getHours() % 12) * 3600 + now.getMinutes() * 60 + now.getSeconds();
    w.onUpdate(() => { const t = t0 + w.t; hh.rotation.z = -(t / 43200) * Math.PI * 2; mh.rotation.z = -(t / 3600) * Math.PI * 2; sh.rotation.z = -(t / 60) * Math.PI * 2; });
    w.sign({ text: 'THE HOTEL IS NEVER LATE', x: cx, y: cy - 2.35, z: cz + 0.02, w: 3.6, h: 0.4, color: '#d8c090', glow: 1.0, tw: 1024, size: 40 });
  }

  // ---- portraits (south wall) -----------------------------------------------------------------------------
  {
    const people = [
      { x: -20.5, name: 'THE FOUNDER', skin: '#e2b48c', hair: '#3a2a1a', stache: true },
      { x: -4.5, name: 'THE FOUNDER’S MOTHER', skin: '#ead0b0', hair: '#c8c8d0', glasses: true },
      { x: 4.5, name: 'EMPLOYEE OF THE MONTH', skin: '#b98a62', hair: '#101010', stache: true, monocle: true },
      { x: 20.5, name: 'A GUEST (STILL HERE)', skin: '#d8a880', hair: '#6a3a1a', beard: true },
    ];
    const PW = 256, PH = 320, EXPR = ['neutral', 'smug', 'asleep', 'sideeye', 'shock', 'wink', 'angry'];
    const drawFace = (g, p, expr, pupil) => {
      const bg = g.createLinearGradient(0, 0, 0, PH); bg.addColorStop(0, '#2a1410'); bg.addColorStop(1, '#120808'); g.fillStyle = bg; g.fillRect(0, 0, PW, PH);
      g.fillStyle = '#16161c'; g.beginPath(); g.ellipse(128, PH + 10, 120, 100, 0, 0, 7); g.fill();                        // shoulders
      g.fillStyle = '#f2f0e8'; g.beginPath(); g.moveTo(104, 232); g.lineTo(152, 232); g.lineTo(128, 300); g.closePath(); g.fill();       // shirt
      g.fillStyle = '#8a1030'; g.beginPath(); g.moveTo(128, 238); g.lineTo(106, 228); g.lineTo(106, 252); g.closePath(); g.moveTo(128, 238); g.lineTo(150, 228); g.lineTo(150, 252); g.closePath(); g.fill();
      g.fillStyle = p.skin; g.fillRect(112, 190, 32, 46);                                                                      // neck
      g.fillStyle = p.hair; g.beginPath(); g.ellipse(128, 118, 58, 70, 0, 0, 7); g.fill();
      g.fillStyle = p.skin; g.beginPath(); g.ellipse(128, 132, 51, 63, 0, 0, 7); g.fill();                                      // face
      g.fillStyle = p.hair; g.beginPath(); g.ellipse(128, 78, 54, 24, 0, Math.PI, 0); g.fill();                                 // hairline
      const eye = (ex, closed) => {
        const ey = 128;
        if (closed) { g.strokeStyle = '#2a1a10'; g.lineWidth = 4; g.beginPath(); g.arc(ex, ey, 11, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); return; }
        const big = expr === 'shock' ? 1.35 : 1;
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, ey, 13 * big, 9 * big, 0, 0, 7); g.fill();
        g.fillStyle = '#1a1208'; g.beginPath(); g.arc(ex + pupil * 3.2 + (expr === 'sideeye' ? 7 : 0), ey + (expr === 'sideeye' ? 1 : 0), expr === 'shock' ? 3.5 : 5.2, 0, 7); g.fill();
      };
      eye(104, expr === 'asleep'); eye(152, expr === 'asleep' || expr === 'wink');
      g.strokeStyle = p.hair; g.lineWidth = 5; g.lineCap = 'round';                                                              // brows
      const brow = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
      if (expr === 'smug') { brow(90, 110, 118, 108); brow(138, 100, 166, 108); }
      else if (expr === 'angry') { brow(90, 104, 118, 114); brow(138, 114, 166, 104); }
      else if (expr === 'shock') { brow(90, 98, 118, 96); brow(138, 96, 166, 98); }
      else if (expr === 'sideeye') { brow(90, 112, 118, 112); brow(138, 112, 166, 112); }
      else { brow(90, 108, 118, 108); brow(138, 108, 166, 108); }
      g.strokeStyle = '#b07858'; g.lineWidth = 4; g.beginPath(); g.moveTo(128, 134); g.lineTo(122, 160); g.lineTo(132, 162); g.stroke();   // nose
      if (p.stache) { g.fillStyle = p.hair; g.beginPath(); g.ellipse(112, 172, 20, 7, 0.25, 0, 7); g.ellipse(144, 172, 20, 7, -0.25, 0, 7); g.fill(); }
      if (p.beard) { g.fillStyle = p.hair; g.beginPath(); g.ellipse(128, 190, 40, 30, 0, 0, Math.PI); g.fill(); }
      g.strokeStyle = '#6a2a24'; g.lineWidth = 5; g.beginPath();                                                                 // mouth
      if (expr === 'smug') { g.moveTo(108, 186); g.quadraticCurveTo(128, 188, 150, 176); }
      else if (expr === 'shock') { g.fillStyle = '#3a1010'; g.ellipse(128, 188, 9, 13, 0, 0, 7); g.fill(); }
      else if (expr === 'angry') { g.moveTo(108, 190); g.quadraticCurveTo(128, 180, 148, 190); }
      else if (expr === 'asleep') { g.ellipse(128, 188, 8, 5, 0, 0, 7); }
      else if (expr === 'wink') { g.moveTo(108, 184); g.quadraticCurveTo(128, 196, 148, 184); }
      else { g.moveTo(110, 186); g.lineTo(146, 186); }
      g.stroke();
      if (p.glasses) { g.strokeStyle = '#d8a94a'; g.lineWidth = 3; g.beginPath(); g.ellipse(104, 128, 17, 13, 0, 0, 7); g.ellipse(152, 128, 17, 13, 0, 0, 7); g.moveTo(121, 128); g.lineTo(135, 128); g.stroke(); }
      if (p.monocle) { g.strokeStyle = '#d8a94a'; g.lineWidth = 3; g.beginPath(); g.arc(152, 128, 17, 0, 7); g.moveTo(152, 145); g.lineTo(158, 215); g.stroke(); }
      if (expr === 'asleep') { g.fillStyle = '#d8c090'; g.font = `700 26px ${FONT}`; g.textAlign = 'left'; g.fillText('z', 176, 96); g.font = `700 20px ${FONT}`; g.fillText('z', 194, 78); }
    };
    const rnd = rng(23);
    const portraits = people.map((p) => {
      const [c, g] = makeCanvas(PW, PH), tex = track(own.tex, canvasTexture(c));
      const o = { p, g, tex, expr: 'neutral', pupil: 0, unseen: 0, next: 2.5 + rnd() * 3, y: 6.0, z: L.z1 - 0.12 };
      drawFace(g, p, o.expr, o.pupil); tex.needsUpdate = true;
      plane(basic(tex, 0.95), 2.4, 3.0, p.x, o.y, o.z, Math.PI);
      frameBox(p.x, o.y, o.z - 0.02, 2.4, 3.0, Math.PI);
      w.sign({ text: p.name, x: p.x, y: o.y - 1.9, z: o.z - 0.03, w: 2.6, h: 0.32, bg: '#1a120c', color: '#e8c673', border: '#b8892f', size: 22, tw: 512, rotY: Math.PI });
      return o;
    });
    w.onUpdate((dt) => {
      const pl = game.player;
      for (const o of portraits) {
        const seen = inView(game, o.p.x, o.y, o.z, 0.0);
        let dirty = false;
        if (seen) {
          o.unseen = 0;
          // the eyes follow you: which way is the player, as seen from the portrait?
          const rel = THREE.MathUtils.clamp((pl.x - o.p.x) / 6, -1, 1) * -1;
          const q = Math.round(rel * 2);
          if (q !== o.pupil) { o.pupil = q; dirty = true; }
        } else {
          o.unseen += dt;
          if (o.unseen > o.next) {            // ... and when you look away, they get up to something
            o.unseen = 0; o.next = 2 + Math.random() * 5;
            let e; do { e = EXPR[Math.floor(Math.random() * EXPR.length)]; } while (e === o.expr);
            o.expr = e; dirty = true;
          }
        }
        if (dirty) { drawFace(o.g, o.p, o.expr, o.pupil); o.tex.needsUpdate = true; }
      }
    });
  }

  // ---- an inspection certificate beside each elevator -------------------------------------------------------
  {
    const BY = ['A guy', 'The Host', 'Nobody', '(illegible)', 'Floor 13'], RES = ['fine*', 'probably fine', 'ask later', 'lol', '…'], YEAR = ['1987', '1962', 'never', '19??', 'tomorrow'];
    ELEV_X.forEach((ex, i) => {
      const [c, g] = makeCanvas(256, 320);
      g.fillStyle = '#f2ead2'; g.fillRect(0, 0, 256, 320); g.strokeStyle = '#8a6a30'; g.lineWidth = 6; g.strokeRect(8, 8, 240, 304); g.lineWidth = 2; g.strokeRect(18, 18, 220, 284);
      g.fillStyle = '#3a2a14'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `700 22px Georgia, serif`; g.fillText('CERTIFICATE', 128, 50); g.fillText('OF INSPECTION', 128, 78);
      g.font = `18px Georgia, serif`; g.textAlign = 'left';
      g.fillText(`Inspected: ${YEAR[i]}`, 36, 140); g.fillText(`By: ${BY[i]}`, 36, 180); g.fillText(`Result: ${RES[i]}`, 36, 220);
      g.fillStyle = '#8a1030'; g.beginPath(); g.arc(196, 262, 22, 0, 7); g.fill(); g.fillStyle = '#f2ead2'; g.font = `700 20px Georgia, serif`; g.textAlign = 'center'; g.fillText('OK', 196, 263);
      const tex = track(own.tex, canvasTexture(c));
      plane(basic(tex, 0.95), 0.62, 0.78, ex + 3.45, 1.95, L.z0 + 0.4);
      frameBox(ex + 3.45, 1.95, L.z0 + 0.39, 0.62, 0.78, 0, 0.04);
    });
  }

  // ---- a wet-floor sign, right where it is not wet -----------------------------------------------------------------
  {
    const [c, g] = makeCanvas(256, 320);
    g.fillStyle = '#f5c518'; g.fillRect(0, 0, 256, 320); g.fillStyle = '#111'; g.fillRect(0, 0, 256, 18); g.fillRect(0, 302, 256, 18);
    g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `44px ${FONT}`; g.fillText('CAUTION', 128, 62);
    g.font = `56px ${FONT}`; g.fillText('WET', 128, 118); g.fillText('FLOOR', 128, 174);
    g.beginPath(); g.arc(112, 236, 12, 0, 7); g.fill(); g.lineWidth = 9; g.strokeStyle = '#111'; g.beginPath(); g.moveTo(112, 248); g.lineTo(138, 276); g.lineTo(168, 262); g.moveTo(120, 250); g.lineTo(96, 280); g.moveTo(124, 252); g.lineTo(158, 238); g.stroke();
    const tex = track(own.tex, canvasTexture(c));
    const mat = track(own.mat, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
    const x = -4.6, z = 11.4;
    for (const s of [-1, 1]) { const m = new THREE.Mesh(track(own.geo, new THREE.PlaneGeometry(0.5, 0.75)), mat); m.material.side = THREE.DoubleSide; m.position.set(x, 0.38, z + s * 0.14); m.rotation.x = s * -0.2; w.add(m); }
    w.collider({ x, y: 0.4, z, w: 0.55, h: 0.8, d: 0.45 });
  }

  w.onDispose(() => { own.tex.forEach((t) => t.dispose()); own.mat.forEach((m) => m.dispose()); own.geo.forEach((q) => q.dispose()); });
}
