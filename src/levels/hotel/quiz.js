import * as THREE from 'three';
import { glowMaterial, plainMaterial } from '../../engine/materials.js';
import { GOLD, hotelHalo } from './kit.js';

// Hotel quiz rooms: the question bank + the pieces a quiz level is made of (LED board, answer pads, gate).
// Every question has to be answerable by ANY player standing in that room, so each one is gated by what the player
// can actually have seen: controls and the hotel itself are always fair game; Wet Floor questions only appear for
// players who cleared it (they must have, to be here); Campaign 1 questions only if they cleared that level.

const cs = (g, id) => g.cs(id);
const hotelBest = (g, i) => cs(g, 'hotel').levelBest?.[i];
const pilotDone = (g, i) => !!cs(g, 'pilot').levelBest?.[i];

const shuffle = (a, rnd) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const fmtTime = (s) => (s < 60 ? 'Under a minute' : s < 180 ? '1 to 3 minutes' : s < 480 ? '3 to 8 minutes' : 'More than 8 minutes');
const TIMES = ['Under a minute', '1 to 3 minutes', '3 to 8 minutes', 'More than 8 minutes'];

/** Each entry: [pool, make(game) -> {q, a, w:[wrong…]} | null]. */
const BANK = [
  ['keys', () => ({ q: 'Which key asks me\nfor a hint?', a: 'H', w: ['F', 'Q', 'Tab'] })],
  ['keys', () => ({ q: 'Which key makes\nyou jump?', a: 'Space', w: ['Shift', 'Ctrl', 'Enter'] })],
  ['keys', () => ({ q: 'What does E do while\nyou look at a button?', a: 'Presses it', w: ['Eats it', 'Ends the game', 'Nothing. Ever.'] })],
  ['keys', () => ({ q: 'Which key puts you back\nat your checkpoint?', a: 'R', w: ['T', 'Delete', 'Backspace'] })],
  ['keys', () => ({ q: 'Which key says yes to\nbaby mode when I offer?', a: 'B', w: ['Y', 'Enter', 'Z'] })],

  ['hotel', () => ({ q: 'What is the name\nof this hotel?', a: 'Hotel Trust-Me', w: ['Hotel Honest', 'Motel Truthful', 'Hostel Maybe'] })],
  ['hotel', () => ({ q: 'Who is lying to you\nthe most in here?', a: 'The host', w: ['The doorman', 'The piano', 'Nobody, I am fair'] })],

  ['l1', () => ({ q: 'What was dangerous\nin Wet Floor?', a: 'The floor', w: ['The ceiling', 'The sofa', 'The doorman'] })],
  ['l1', () => ({ q: 'What was your checkpoint\nin Wet Floor?', a: 'A grand piano', w: ['A bathtub', 'A giant cake', 'A small horse'] })],
  ['l1', () => ({ q: 'What rolled away from\nunder you in Wet Floor?', a: 'A brass trolley', w: ['The sofa', 'A grand piano', 'The elevator'] })],
  ['l1', () => ({ q: 'What did you climb to\nreach the mezzanine?', a: 'Cocktail tables', w: ['A spiral staircase', 'A very tall ladder', 'The elevator'] })],

  ['dyn', (g) => {
    const b = hotelBest(g, 0); if (!b) return null;
    const a = b.deaths;
    const w = [...new Set([a + 2, a + 5, a + 1, Math.max(0, a - 1), a + 9].filter((n) => n !== a && n >= 0))].slice(0, 3);
    return { q: 'How many times did you\nfall in Wet Floor?', a: String(a), w: w.map(String) };
  }],
  ['dyn', (g) => {
    const b = hotelBest(g, 0); if (!b) return null;
    const a = fmtTime(b.time);
    return { q: 'About how long did\nWet Floor take you?', a, w: TIMES.filter((t) => t !== a).slice(0, 3) };
  }],

  ['pilot', (g) => !pilotDone(g, 0) ? null : { q: 'What was the first level\nof Campaign 1 called?', a: 'The Tutorial', w: ['The Tower', 'Checkpoint Island', 'The Real Ending'] }],
  ['pilot', (g) => !pilotDone(g, 1) ? null : { q: 'In Checkpoint Island,\nwhat did the fake\ncheckpoints do?', a: 'Absolutely nothing', w: ['Saved you', 'Gave you a hat', 'Tidied up'] }],
  ['pilot', (g) => !pilotDone(g, 2) ? null : { q: 'What was Level 3\nof Campaign 1 called?', a: 'The Tower', w: ['The Tutorial', 'The Real Ending', 'Checkpoint Island'] }],
  ['pilot', (g) => !pilotDone(g, 4) ? null : { q: 'How did Campaign 1\nend?', a: 'With a door. Two doors.', w: ['A boss fight', 'A long elevator ride', 'It never ended'] }],
];

/** Pick one question from the first non-empty pool in `pools` (e.g. ['pilot','dyn']). Always 3 answers, correct one shuffled in. */
export function pickQuestion(game, pools, rnd = Math.random) {
  for (const pool of [].concat(pools)) {
    const opts = shuffle(BANK.filter(([p]) => p === pool), rnd).map(([, make]) => make(game)).filter(Boolean);
    if (!opts.length) continue;
    const q = opts[0];
    const wrong = shuffle(q.w, rnd).slice(0, 2);
    const answers = shuffle([{ text: q.a, correct: true }, ...wrong.map((text) => ({ text, correct: false }))], rnd);
    return { q: q.q, answers };
  }
  return null;
}

// ================================================================================================
//  Visuals
// ================================================================================================
const FONT = '"Archivo Black", Impact, sans-serif';

/** The big LED board that shows the question. */
export function boardMesh(w, { x, y, z, width = 10, height = 3.4, header = 'QUESTION', text = '' }) {
  const S = 1024, cw = S, ch = Math.round(S * height / width);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, ch); bg.addColorStop(0, '#120a1c'); bg.addColorStop(1, '#2a1030');
  g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
  g.strokeStyle = '#d8a94a'; g.lineWidth = 10; g.strokeRect(10, 10, cw - 20, ch - 20);
  g.lineWidth = 3; g.strokeRect(28, 28, cw - 56, ch - 56);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#d8a94a'; g.font = `${Math.round(ch * 0.13)}px ${FONT}`; g.fillText(header, cw / 2, ch * 0.17);
  const lines = String(text).split('\n');
  let fs = Math.round(ch * 0.2);
  for (;;) { g.font = `${fs}px ${FONT}`; if (Math.max(...lines.map((l) => g.measureText(l).width)) < cw - 110 || fs < 24) break; fs -= 2; }
  g.fillStyle = '#fff6e0'; g.shadowColor = '#ffb040'; g.shadowBlur = 14;
  const lh = fs * 1.12, top = ch * 0.58 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => g.fillText(l, cw / 2, top + i * lh));
  g.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  w.ownTextures.push(tex);
  const grp = new THREE.Group(); grp.position.set(x, y, z);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  grp.add(face);
  const frame = (fx, fy, fw, fh) => { const m = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.3), plainMaterial(GOLD, { metalness: 1, roughness: 0.3 })); m.position.set(fx, fy, -0.12); m.castShadow = false; grp.add(m); };
  frame(0, height / 2 + 0.12, width + 0.5, 0.24); frame(0, -height / 2 - 0.12, width + 0.5, 0.24);
  frame(-width / 2 - 0.12, 0, 0.24, height); frame(width / 2 + 0.12, 0, 0.24, height);
  const back = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, height + 0.4, 0.2), plainMaterial(0x0c0810, { roughness: 0.5 })); back.position.z = -0.1; grp.add(back);
  // marquee bulbs round the frame
  const bulbs = [];
  const bm = glowMaterial(0xffd890, 2.6), bgeo = new THREE.SphereGeometry(0.07, 8, 6);
  const nx = Math.round(width / 0.5), ny = Math.round(height / 0.5);
  const addBulb = (bx, by) => { const b = new THREE.Mesh(bgeo, bm); b.position.set(bx, by, 0.05); grp.add(b); bulbs.push(b); };
  for (let i = 0; i <= nx; i++) { const bx = -width / 2 + (i * width) / nx; addBulb(bx, height / 2 + 0.12); addBulb(bx, -height / 2 - 0.12); }
  for (let i = 1; i < ny; i++) { const by = -height / 2 + (i * height) / ny; addBulb(-width / 2 - 0.12, by); addBulb(width / 2 + 0.12, by); }
  w.add(grp);
  hotelHalo(w, x, y, z + 0.6, width * 1.15, 0xffb860, 0.12);
  w.onUpdate((dt, t) => { const k = Math.floor(t * 3) % 2; bulbs.forEach((b, i) => { b.visible = (i + k) % 2 === 0 || i % 5 === 0; }); });
  return grp;
}

/** The little standee above an answer pad (letter + answer text). Returns a mesh to attach to the pad. */
export function answerTag(letter, text, { width = 3.2, height = 1.5 } = {}) {
  const S = 512, ch = Math.round(S * height / width);
  const c = document.createElement('canvas'); c.width = S; c.height = ch;
  const g = c.getContext('2d');
  g.fillStyle = '#15101c'; g.fillRect(0, 0, S, ch);
  g.strokeStyle = '#d8a94a'; g.lineWidth = 8; g.strokeRect(6, 6, S - 12, ch - 12);
  g.fillStyle = '#d8a94a'; g.beginPath(); g.arc(70, ch / 2, 46, 0, 7); g.fill();
  g.fillStyle = '#15101c'; g.font = `${70}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, 70, ch / 2 + 4);
  const words = String(text).split(' ');
  let lines = [text];
  if (g.measureText(text).width > 0 && text.length > 14) { const mid = Math.ceil(words.length / 2); lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')].filter(Boolean); }
  let fs = 50;
  for (;;) { g.font = `${fs}px ${FONT}`; if (Math.max(...lines.map((l) => g.measureText(l).width)) < S - 190 || fs < 20) break; fs -= 2; }
  g.fillStyle = '#fff6e0'; g.textAlign = 'center';
  const lh = fs * 1.1;
  lines.forEach((l, i) => g.fillText(l, 70 + (S - 70) / 2 + 10, ch / 2 + (i - (lines.length - 1) / 2) * lh + 3));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
  m.userData.tex = tex;
  return m;
}

const STATE_COLOR = { idle: [0, 0, 0, 0], lock: [1.0, 0.75, 0.2, 0.34], right: [0.2, 1.0, 0.45, 0.5], wrong: [1.0, 0.18, 0.2, 0.55], out: [0.5, 0.1, 0.12, 0.3] };

/**
 * An answer pad: a marble slab with a status overlay, a floating answer standee and a letter on the top.
 * Standing on it for `dwell` seconds locks the answer in. Returns { plat, state, set(state) }.
 */
export function makePad(w, { x, z, y = 0, wd = 3.4, dp = 3.2, letter, text, correct, dwell = 0.9 }) {
  const plat = w.plat({ x, y, z, w: wd, d: dp, h: 0.6, tex: 'marble', color: 0xd8d4e0, roughness: 0.25, radius: 0.08 });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(wd + 0.04, 0.08, dp + 0.04), glowMaterial(GOLD, 1.3));
  trim.position.set(0, 0.3 - 0.12, 0); trim.matrixAutoUpdate = true;
  plat.group.add(trim);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5, toneMapped: false });
  const over = new THREE.Mesh(new THREE.PlaneGeometry(wd - 0.2, dp - 0.2), mat);
  over.rotation.x = -Math.PI / 2; over.position.y = 0.3 + 0.01; plat.group.add(over);
  // letter on the pad
  const lc = document.createElement('canvas'); lc.width = lc.height = 256;
  const lg = lc.getContext('2d'); lg.fillStyle = '#7a5a1c'; lg.font = `190px ${FONT}`; lg.textAlign = 'center'; lg.textBaseline = 'middle'; lg.fillText(letter, 128, 140);
  const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace; w.ownTextures.push(lt);
  const lm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: lt, transparent: true, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  lm.rotation.x = -Math.PI / 2; lm.position.set(0, 0.3 + 0.012, 0.0); plat.group.add(lm);
  // the standee floats above the far edge of the pad
  const tag = answerTag(letter, text);
  tag.position.set(0, 2.6, -dp / 2 - 0.2);
  plat.group.add(tag);
  plat.group.matrixAutoUpdate = true;
  plat.o.moving = true;
  const pad = { plat, correct, letter, text, state: 'idle', lockT: 0, dwell, over, tag, fall: 0, vy: 0, eliminated: false };
  pad.set = (s) => {
    pad.state = s; const c = STATE_COLOR[s === 'gone' ? 'out' : s] || STATE_COLOR.idle;
    mat.color.setRGB(c[0], c[1], c[2]); mat.opacity = c[3];
  };
  pad.set('idle');
  pad.pulse = (t) => { if (pad.state === 'lock') mat.opacity = 0.22 + 0.2 * Math.sin(t * 22); };
  return pad;
}

/** A full-width glowing gate that blocks the way until opened. Returns { open(), close(), isOpen }. */
export function makeGate(w, { x = 0, y0 = -10, y1 = 13, z, width = 28, label = 'LOCKED' }) {
  const body = w.collider({ x, y: (y0 + y1) / 2, z, w: width, h: y1 - y0, d: 0.5 });
  const grp = new THREE.Group(); grp.position.set(x, 0, z);
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(width, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.25, 0.3), transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  curtain.position.y = 6; grp.add(curtain);
  const bars = [];
  for (let i = -Math.floor(width / 2); i <= Math.floor(width / 2); i += 4) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 12, 0.04), glowMaterial(0xff4060, 1.1)); b.position.set(i, 6, 0); grp.add(b); bars.push(b);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, 0.18), glowMaterial(0xff4060, 1.2)); top.position.y = 12; grp.add(top);
  const bot = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, 0.18), glowMaterial(0xff4060, 1.2)); bot.position.y = 0.05; grp.add(bot);
  w.add(grp);
  const gate = { body, grp, isOpen: false, t: 0 };
  const recolor = (r, g, b) => { curtain.material.color.setRGB(r, g, b); for (const m of [...bars, top, bot]) m.material.color.setRGB(r * 1.2, g * 1.2, b * 1.2); };
  gate.open = () => { gate.isOpen = true; body.enabled = false; recolor(0.2, 1.0, 0.45); };
  gate.close = () => { gate.isOpen = false; body.enabled = true; gate.t = 0; recolor(1.0, 0.25, 0.3); grp.visible = true; grp.position.y = 0; };
  gate.update = (dt) => { if (gate.isOpen && gate.t < 1) { gate.t = Math.min(1, gate.t + dt * 1.6); grp.position.y = gate.t * 12.5; if (gate.t >= 1) grp.visible = false; } };
  return gate;
}
