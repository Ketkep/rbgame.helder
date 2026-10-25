import * as THREE from 'three';
import { stalker } from './stalker.js';
import { scares } from './scare.js';
import { roles } from './roles.js';
import { horrorEnv, exitDoor, checkpoint, door, room, box, decal, locker, curtain, gurney, wheelchair, pipes, desk, barWindow, stencil } from './kit.js';
import { sigil, bench, cabinet, keyMesh, shelf, pillar, railPost, leverConsole, monitor } from './records-kit.js';
import { botSteps } from '../coop/kit.js';

// Chapter 3 — Records Room. You each read a DIFFERENT version of every file. A code is split between the two of you, the key hunt is a
// sigil puzzle only the two copies solve together, the key is a single object one of you ends up holding (the first private whisper tells the
// Keyholder to keep it), and the archive is a dark maze of sliding shelves that one of you walks while the other reads the plan.
// Beats: 1 lobby + split code · 2 corridor, the cross hall and the Orderly · 3 Duty Office files (two versions) · 4 staff lockers, key hunt,
// the Orderly comes looking · 5 the key · 6 archive gate · 7 Plan Room · 8 maze, walker/reader · 9 swap, shelves on a timer · 10 vault, flipped files.

const esc = (s) => String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
const PI = Math.PI;
const CODE = [4, 1, 7, 2];

// the archive maze (7 x 6 cells of 4 m, row 0 = south). E[c][r] / N[c][r] = '1' when the passage east / north of cell (c,r) is open. Banks A B C are
// sliding shelves: each sits in slot X (blocking the route) and slides along its rail to slot Y (the neighbouring wall slot) when its lever is thrown.
const MAZE = { E: ['100001', '111111', '001111', '011010', '110001', '101001', '000000'], N: ['111110', '010100', '100000', '101000', '001010', '101110', '110110'] };
const BANKS = [
  { id: 'A', X: { t: 'E', c: 5, r: 2 }, Y: { t: 'E', c: 5, r: 1 } },
  { id: 'B', X: { t: 'N', c: 1, r: 3 }, Y: { t: 'N', c: 2, r: 3 } },
  { id: 'C', X: { t: 'N', c: 0, r: 2 }, Y: { t: 'N', c: 1, r: 2 } },
];
const ROUTE = '3:0 3:1 4:1 5:1 5:0 6:0 6:1 6:2 5:2 5:3 5:4 5:5 4:5 4:4 3:4 2:4 1:4 1:3 2:3 3:3 3:2 2:2 1:2 1:1 2:1 2:0 1:0 0:0 0:1 0:2 0:3 0:4 0:5 1:5 2:5 3:5'.split(' ').map((s) => s.split(':').map(Number));
const BANK_AT = [7, 16, 29];                                                  // ROUTE index of the cell just before each bank
const CX = (c) => -12 + 4 * c, CZ = (r) => -50 - 4 * r;
const edgeCentre = (e) => (e.t === 'E' ? { x: CX(e.c) + 2, z: CZ(e.r), along: 'z' } : { x: CX(e.c), z: CZ(e.r) - 2, along: 'x' });
const sameEdge = (a, b) => a.t === b.t && a.c === b.c && a.r === b.r;
const HOLD = 22;                                                              // seconds a shelf stays open in the second crossing

export default {
  id: 'lowtide3',
  name: 'Records Room',
  music: 'l1',
  horror: true,
  deathRule: 'self',
  completeQuip: 'Records updated. Both copies now agree. Please do not check.',
  titleCam: { center: [0, 2, -50], radius: 22, height: 10 },

  build(w, game) {
    const H = horrorEnv(w, game, { density: 0.058 });
    const c = w.coop, me = c.me, other = c.other;
    w.spawn = { x: me === 'p1' ? -2.2 : 2.2, y: 0, z: 2.5, yaw: 0 };
    w.respawn = { ...w.spawn };
    const R = roles(w, game);
    const tell = (r, k, o) => c.tell(r, k, o);
    const S = H.S;
    const names = () => ({ M: esc(c.names[me]), O: esc(c.names[other]) });
    const sayAll = (k, o) => tell('all', k, o);
    const toast = (t, kind = '') => game.ui?.toast?.(t, kind);

    // ================================================================ helpers ====================================================
    const front = (x, z, rot, d) => ({ x: x + Math.sin(rot) * d, z: z + Math.cos(rot) * d });
    /** A sheet of paper you can read; `html` may be a string or { keyholder, subject } (getters allowed, so names are read late). */
    const paper = ({ x, y, z, rot = 0, title, html, label = 'Read', onRead, size = 0.3, face = null }) => {
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 1.3), new THREE.MeshStandardMaterial({ color: 0xcfc8b0, roughness: 1, emissive: 0x2a2514, emissiveIntensity: 0.55 }));
      pm.position.set(x, y, z); if (face) pm.rotation.set(0, Math.atan2(face.nx, face.nz), 0); else pm.rotation.set(-PI / 2 + 0.05, 0, rot); w.add(pm);
      let read = false;
      const pick = () => (typeof html === 'string' ? html : (html[c.me] ?? html[R.mine] ?? html.all ?? ''));
      w.interactable({
        x, y: y + 0.35, z, w: 0.8, h: 1.7, d: 0.8, range: 3.2, pad: 0.1,
        label: () => (read ? 'Read again' : label),
        onUse: async (g) => { const { readModal } = await import('../hotel/escape-kit.js'); readModal(g, { title, html: pick() }); if (!read) { read = true; onRead?.(); } },
      });
      return pm;
    };
    /** A generic press-E thing. Box is centred on (x, y, z); keep it off solid colliders. */
    const press = ({ x, y = 1.3, z, bw = 0.6, bh = 1.6, bd = 0.6, label, enabled, onUse, range = 3.2 }) => w.interactable({ x, y, z, w: bw, h: bh, d: bd, range, pad: 0.1, label, enabled, onUse });
    /** run `fn(who)` once on both machines the first time a box is entered (who = 'p1' | 'p2' = the one inside; p1 if both). */
    const trip = (name, bx, fn, cond) => {
      let fired = false;
      c.onEvent('c3:' + name, (a) => { if (fired) return; fired = true; fn(a?.who || 'p1'); });
      c.zone({ ...bx, need: 'any', shrink: 0 }).onChange((zn) => { if (zn.active && !fired && (!cond || cond())) c.emit('c3:' + name, { who: zn.p1 && !zn.p2 ? 'p1' : zn.p2 && !zn.p1 ? 'p2' : (zn.mine ? me : other) }); });
    };
    const mineIf = (who) => who === me;

    // ================================================================ 1. lobby =================================================
    room(w, { x: 0, z: 0, w: 16, d: 12, doors: { n: [{ c: 0, w: 1.8 }] } });
    stencil(w, 'CHAPTER 3 · RECORDS ROOM', { x: -3.6, y: 2.6, z: -5.8, rot: 0, width: 4.6, size: 0.42 });
    H.lamp({ x: -3, y: 3.35, z: -1, mode: 'buzz', rot: 0 }); H.lamp({ x: 3.4, y: 3.35, z: 3, mode: 'dying', rot: 0 }); H.lamp({ x: -4, y: 3.35, z: 3.5, mode: 'dead' }); H.lamp({ x: 0.5, y: 3.35, z: -4.6, mode: 'steady', len: 0.8, power: 0.6 });
    barWindow(w, { x: 7.82, y: 1.9, z: -0.5, rot: -PI / 2 });
    pipes(w, { x0: -7.4, z0: 5, x1: -7.4, z1: -5, y: 3.0, n: 2 });
    bench(w, { x: 7.0, z: 2.6, rot: PI / 2 }); bench(w, { x: 7.0, z: -3.0, rot: PI / 2 });
    desk(w, { x: -4.6, z: -3.4, rot: PI / 2 });
    cabinet(w, { x: -7.5, z: 4.4, rot: PI / 2 }); cabinet(w, { x: -7.5, z: 3.7, rot: PI / 2, open: 1 });
    wheelchair(w, { x: 4.4, z: 4.6, rot: 3.5 });
    decal(w, { kind: 'puddle', seed: 4, x: 2.8, y: 0.025, z: -1.8, w: 2.6, h: 2.6 });
    decal(w, { kind: 'drag', seed: 11, x: -1, y: 0.02, z: -4, w: 3.6, h: 2.2, face: 'floor', rot: 1.57 });
    decal(w, { kind: 'hand', seed: 6, x: 7.84, y: 1.2, z: 1.2, w: 0.5, h: 0.5, face: 'e' });
    decal(w, { kind: 'scratch', seed: 9, x: -7.84, y: 1.5, z: -1, w: 1.5, h: 1.5, face: 'w' });
    stencil(w, 'PLEASE WAIT', { x: 0, y: 2.7, z: 5.82, rot: PI, width: 3.2, size: 0.4 });
    checkpoint(w, { x: -3, z: -2 });
    // the sign-in sheet and the notice board
    paper({
      x: -4.6, y: 0.82, z: -3.4, title: 'SIGN-IN',
      html: {
        get keyholder() { const n = names(); return `<b>NIGHT STAFF · SIGN-IN</b><br><i>Lowtide Memorial, Records Wing</i><p>02:41 escorted <b>${n.O}</b> to Ward B. Sedated, compliant.<br>02:58 records door re-coded (new moon).<br>03:05 please do not discuss the chart with the patient.</p><p><b>Records door:</b> &nbsp; <b>4 &nbsp;1 &nbsp;_ &nbsp;_</b><br>The back half is printed on the patient's copy. Do not carry both copies in one hand.</p>`; },
        get subject() { const n = names(); return `<b>PATIENT ADMISSIONS · NIGHT</b><br><i>Lowtide Memorial, Records Wing</i><p>02:41 <b>${n.M}</b>. Belongings: one wristband. Escort: staff (initials smudged).<br>02:58 The nurse read the chart aloud. It was not my chart.</p><p><b>Records door:</b> &nbsp; <b>_ &nbsp;_ &nbsp;7 &nbsp;2</b><br>The front half stays with staff. It is on their copy. They will not tell you. Ask anyway.</p>`; },
      },
    });
    box(w, { x: -7.8, y: 1.7, z: 0.4, w: 0.1, h: 1.3, d: 2.2, kind: 'wood', color: 0x4a3a2c });
    paper({ x: -7.6, y: 1.5, z: 0.4, rot: PI / 2, face: { nx: 1, nz: 0 }, title: 'NOTICE', html: '<b>RECORDS WING</b><p>After midnight: files stay in the room. Patients must be accompanied. Do not compare copies. Do not read your copy aloud to the other party.</p><p><i>The Night Desk reminds you that comparing copies is how the files get confused.</i></p><p style="opacity:.7">(Someone has crossed out "confused" and written "corrected".)</p>', size: 0.4 });
    // the keypad: four dials, shared
    const dial = [0, 0, 0, 0], dialTex = [], dialCv = [];
    box(w, { x: 2.7, y: 1.5, z: -5.77, w: 1.9, h: 1.0, d: 0.1, kind: 'rust', color: 0x252b2e });
    stencil(w, 'RECORDS · STAFF', { x: 2.7, y: 2.15, z: -5.8, rot: 0, width: 1.9, size: 0.3 });
    const D0 = door(w, { x: 0, z: -6, along: 'x', width: 1.8, key: 'rec', locked: true, label: 'records door', game });
    const drawDial = (i) => {
      const cv = dialCv[i], g = cv.getContext('2d'); g.fillStyle = '#071a14'; g.fillRect(0, 0, 64, 96);
      g.fillStyle = '#6dffb4'; g.font = '700 70px "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(dial[i]), 32, 52); g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < 96; y += 3) g.fillRect(0, y, 64, 1);
      dialTex[i].needsUpdate = true;
    };
    for (let i = 0; i < 4; i++) {
      const dx = 2.05 + i * 0.4;
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 96; dialCv.push(cv); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; dialTex.push(t);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.45), new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) })); pl.position.set(dx, 1.5, -5.7); w.add(pl);
      drawDial(i);
      c.on('dial:' + i, (v) => { dial[i] = v | 0; drawDial(i); if (c.isHost && dial.every((q, k) => q === CODE[k]) && D0.locked) { D0.unlock(); D0.setOpen(true); } });
      press({ x: dx, y: 1.45, z: -5.5, bw: 0.34, bh: 1.2, bd: 0.3, label: () => `Dial ${i + 1} (${dial[i]})`, onUse: () => { c.set('dial:' + i, (dial[i] + 1) % 10); S.tick?.(); game.audio.confirm?.(); } });
    }
    c.on('dr:rec', (v) => { if (v && v.locked === false) { S.door(0, 0.2); } });
    sayAll('lt.c3.intro', { priority: 2 });
    trip('dials', { x: 2.6, y: 1, z: -3.6, w: 3.6, h: 3, d: 3 }, () => { sayAll('lt.c3.dials'); });
    trip('opened', { x: 0, y: 1, z: -7.2, w: 2.4, h: 3, d: 1.6 }, () => {
      sayAll('lt.c3.opened');
      w.after(14, () => { Z.behind('patient', { role: me, dist: 3.2 }); });
    });

    // ================================================================ 2. corridor and the cross hall =============================
    room(w, { x: 0, z: -10.5, w: 4.6, d: 9, sides: { s: false, n: false } });
    for (const [z, m] of [[-8, 'buzz'], [-11.4, 'dying'], [-14, 'dead']]) H.lamp({ x: 0, y: 3.35, z, mode: m, rot: PI / 2, len: 1.3 });
    pipes(w, { x0: -1.9, z0: -6.4, x1: -1.9, z1: -14.8, y: 2.9, n: 2 });
    gurney(w, { x: 1.4, z: -9.2, rot: 0.2, solid: true }); wheelchair(w, { x: -1.5, z: -12.4, rot: -2.2 });
    stencil(w, 'RECORDS →', { x: -2.12, y: 2.4, z: -10.5, rot: PI / 2, width: 2.6, size: 0.4 });
    decal(w, { kind: 'drag', seed: 12, x: 0, y: 0.02, z: -12, w: 3, h: 3.4, face: 'floor', rot: 0 });
    decal(w, { kind: 'splat', seed: 3, x: 1.2, y: 0.02, z: -7.6, w: 1.8, h: 1.8 });
    decal(w, { kind: 'hand', seed: 2, x: 2.14, y: 1.0, z: -13.2, w: 0.5, h: 0.5, face: 'e' });
    trip('corr', { x: 0, y: 1, z: -9, w: 4.4, h: 3, d: 1.5 }, () => { sayAll('lt.c3.corr'); });
    trip('hall', { x: 0, y: 1, z: -13.6, w: 4.4, h: 3, d: 1.2 }, () => { sayAll('lt.c3.hall', { priority: 2 }); });

    // the cross hall, 48 m long, patrolled
    room(w, { x: 0, z: -18, w: 48, d: 6, doors: { s: [{ c: 0, w: 2.2 }], n: [{ c: -15, w: 2.0 }, { c: 0, w: 2.2 }, { c: 15, w: 2.0 }] }, floorKind: 'tile', wallKind: 'tile' });
    for (const [x, m] of [[-19, 'dead'], [-12, 'buzz'], [-6, 'dying'], [0, 'steady'], [6, 'buzz'], [12, 'dying'], [19, 'dead']]) H.lamp({ x, y: 3.35, z: -18, mode: m, rot: 0, len: 1.4, power: m === 'steady' ? 0.75 : 1 });
    for (const x of [-9.6, -9.0, -8.4, 8.4, 9.0, 9.6]) locker(w, { x, z: -15.5, rot: PI, ajar: x === 9.0 ? 0.6 : 0 });
    gurney(w, { x: -4.5, z: -19.6, rot: PI / 2, solid: true }); wheelchair(w, { x: 5.2, z: -20.1, rot: 0.6 });
    stencil(w, 'WARD A ←', { x: -14, y: 2.5, z: -15.17, rot: PI, width: 3, size: 0.4 }); stencil(w, '→ WARD C', { x: 14, y: 2.5, z: -15.17, rot: PI, width: 3, size: 0.4 });
    barWindow(w, { x: -23.82, y: 1.9, z: -18, rot: PI / 2 }); barWindow(w, { x: 23.82, y: 1.9, z: -18, rot: -PI / 2 });
    decal(w, { kind: 'puddle', seed: 6, x: -17, y: 0.025, z: -18.5, w: 3, h: 2.4 }); decal(w, { kind: 'drag', seed: 5, x: 3, y: 0.02, z: -18, w: 6, h: 2.2, face: 'floor', rot: 1.57 });
    decal(w, { kind: 'hand', seed: 9, x: -6, y: 1.2, z: -15.17, w: 0.5, h: 0.5, face: 's' }); decal(w, { kind: 'scratch', seed: 3, x: 6, y: 1.4, z: -15.17, w: 1.5, h: 1.5, face: 's' });
    decal(w, { kind: 'splat', seed: 8, x: 16, y: 0.02, z: -17, w: 2.6, h: 2.6 });
    pipes(w, { x0: -23, z0: -20.4, x1: 23, z1: -20.4, y: 2.95, n: 2 });
    cabinet(w, { x: -3.6, z: -20.55, rot: PI }); cabinet(w, { x: -2.9, z: -20.55, rot: PI, drawers: 3 }); cabinet(w, { x: 3.2, z: -20.55, rot: PI });
    checkpoint(w, { x: 0, z: -33 });

    // ================================================================ 3. the Duty Office (west) =====================================
    room(w, { x: -15, z: -25.5, w: 10, d: 9, sides: { s: false } });
    H.lamp({ x: -15, y: 3.35, z: -25, mode: 'dying', len: 1.2 }); H.lamp({ x: -12, y: 3.35, z: -28, mode: 'buzz', len: 1 });
    stencil(w, 'DUTY OFFICE', { x: -15, y: 2.7, z: -29.82, rot: 0, width: 3.2, size: 0.42 });
    desk(w, { x: -16.2, z: -27.4, rot: 0 });
    for (let i = 0; i < 4; i++) cabinet(w, { x: -19.5, z: -22.9 - i * 0.62, rot: PI / 2, open: i === 2 ? 1 : -1 });
    cabinet(w, { x: -11, z: -29.5, rot: 0 }); cabinet(w, { x: -10.4, z: -29.5, rot: 0, drawers: 3 });
    box(w, { x: -19.8, y: 1.7, z: -26.5, w: 0.1, h: 1.2, d: 2.2, kind: 'wood', color: 0x4a3a2c });
    decal(w, { kind: 'scratch', seed: 21, x: -19.83, y: 1.5, z: -26.5, w: 1.8, h: 1.8, face: 'w' });
    decal(w, { kind: 'puddle', seed: 8, x: -13.5, y: 0.025, z: -24.4, w: 2.4, h: 2.4 }); decal(w, { kind: 'splat', seed: 14, x: -16, y: 0.02, z: -26.6, w: 1.6, h: 1.6 });
    decal(w, { kind: 'hand', seed: 4, x: -10.16, y: 1.2, z: -26, w: 0.5, h: 0.5, face: 'e' });
    // the patient file: two versions
    paper({
      x: -16.7, y: 0.82, z: -27.4, title: 'CASE FILE 0417-B', size: 0.34,
      html: {
        get keyholder() { const n = names(); return `<b>CASE FILE 0417-B · CONFIDENTIAL</b> <i>(staff copy)</i><p><b>Patient:</b> ${n.O}<br><b>Attending:</b> ▇▇▇▇▇▇▇ <i>(signature smudged)</i><br><b>Admitted:</b> 14 March &nbsp;·&nbsp; <b>Status:</b> compliant, sedated.</p><p>Presenting delusion: the patient believes the hospital is flooding, and that the person walking beside them is also a patient. Do not correct either belief. Reinforce the name <b>${n.M}</b>.</p><p>The archive key is not kept on the ring. It is kept <i>behind the patient's mark</i> in the staff lockers, east room. The mark has <b>a single drop</b> inside it. <u>Staff only:</u> the patient must not be told which locker.</p><p style="opacity:.75"><i>Margin, in pencil:</i> memory of the last 48 h removed. Dose 40 mg. Repeat at 03:30.</p>`; },
        get subject() { const n = names(); return `<b>PATIENT'S COPY</b> <i>(found under the mattress, hand-written)</i><p>They write another name on my chart. <b>${n.O}</b>. It is not mine. I am <b>${n.M}</b>. I am nearly sure I am ${n.M}.</p><p>The one who walks beside me knows where the key is. They were told not to tell me. I do not know if they know that they know.</p><p>I scratched my sign on the back of my wristband with a pin, so I would have one thing that was only mine: <b>a thin crescent, open to the right.</b> The staff copy will say what goes inside it.</p><p style="opacity:.8">They check the files after midnight. The water is not coming. It is already in the walls. Do not read this aloud. <i>(Read it aloud.)</i></p>`; },
      },
      onRead: () => { sayAll('lt.c3.fileread'); },
    });
    // the phone
    const phone = box(w, { x: -15.1, y: 0.85, z: -27.3, w: 0.3, h: 0.14, d: 0.22, kind: 'rust', color: 0x151a1c });
    let ringing = false, ringT = 0;
    press({ x: -15.1, y: 1.2, z: -27.3, bw: 0.6, bh: 1.4, bd: 0.6, label: () => (ringing ? 'Answer the telephone' : 'Telephone'), onUse: () => { c.emit('c3:phone'); } });
    c.onEvent('c3:phone', () => { if (!ringing) { sayAll('lt.c3.phone.dead'); return; } ringing = false; Z.whisper({}); S.static(0.6, 0.12); sayAll('lt.c3.phone.pick', { priority: 2 }); });
    trip('office', { x: -15, y: 1, z: -25, w: 9, h: 3, d: 6 }, () => {
      sayAll('lt.c3.office');
      w.after(55, () => { ringing = true; ringT = 0; sayAll('lt.c3.phone.ring'); });
      w.after(150, () => { sayAll('lt.c3.wrong1'); Z.partnerWrong(4.5, {}); });
    });
    w.updaters.push((dt) => { if (!ringing) return; ringT += dt; if (ringT % 1.7 < dt) S.intercom(); phone.position.x = -15.1 + Math.sin(w.t * 60) * 0.004; if (ringT > 40) ringing = false; });
    // wall PA: lures the Orderly to the EAST end
    const pa = (x, z, nx, nz, label, to) => {
      box(w, { x, y: 1.5, z, w: nx ? 0.08 : 0.5, h: 0.7, d: nz ? 0.08 : 0.5, kind: 'rust', color: 0x3b4543 });
      const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a30).multiplyScalar(2), toneMapped: false })); bt.rotation.x = Math.PI / 2; bt.position.set(x + nx * 0.07, 1.55, z + nz * 0.07); if (nx) bt.rotation.set(0, 0, Math.PI / 2); w.add(bt);
      let cool = 0; w.updaters.push((dt) => { cool = Math.max(0, cool - dt); });
      press({ x: x + nx * 0.4, y: 1.5, z: z + nz * 0.4, bw: nx ? 0.4 : 0.8, bd: nz ? 0.4 : 0.8, bh: 1.4, label: () => (cool > 0 ? 'The speaker is still ringing' : label), onUse: () => { if (cool > 0) return; cool = 18; c.emit('c3:page', to); } });
    };
    pa(-10.25, -26, -1, 0, 'Page the Orderly (east end)', { x: 21, z: -18 });

    // ================================================================ 4. the staff lockers (east) ==================================
    room(w, { x: 15, z: -25.5, w: 10, d: 9, sides: { s: false } });
    H.lamp({ x: 15, y: 3.35, z: -25, mode: 'dying', len: 1.2 }); H.lamp({ x: 12, y: 3.35, z: -28, mode: 'dead' }); H.lamp({ x: 18.2, y: 3.35, z: -23, mode: 'buzz', len: 1 });
    stencil(w, 'STAFF · EAST', { x: 17.6, y: 2.7, z: -29.82, rot: 0, width: 2.4, size: 0.4 });
    pa(10.2, -23, 1, 0, 'Page the Orderly (west end)', { x: -21, z: -18 });
    bench(w, { x: 16.8, z: -23.2, rot: 0 });
    curtain(w, { x: 19.3, z: -25.5, width: 3.6, rot: PI / 2 });
    for (let i = 0; i < 4; i++) locker(w, { x: 10.45, z: -27.2 + i * 0.64, rot: PI / 2, ajar: i === 1 ? 0.5 : 0 });
    decal(w, { kind: 'puddle', seed: 10, x: 14, y: 0.025, z: -26.5, w: 2.8, h: 2.8 }); decal(w, { kind: 'drag', seed: 13, x: 15, y: 0.02, z: -23.4, w: 3, h: 2.4, face: 'floor', rot: 1.57 }); decal(w, { kind: 'hand', seed: 12, x: 19.84, y: 1.1, z: -28, w: 0.5, h: 0.5, face: 'e' });
    decal(w, { kind: 'splat', seed: 5, x: 12.5, y: 0.02, z: -23.5, w: 1.6, h: 1.6 });
    // the six lockers on the north wall, each with a scratched sigil
    const SIG = ['spiral', 'eye', 'moonR', 'star', 'moonL', 'moonRplain'];
    const LX = [11.6, 12.5, 13.4, 14.3, 15.2, 16.1], LZ = -29.55;
    const keyObj = keyMesh(w, { x: LX[2], y: 1.28, z: LZ + 0.32, rot: PI / 2, scale: 1.3 }); keyObj.visible = false;
    const keyGlint = new THREE.PointLight(0xffd27a, 0, 4, 2); keyGlint.position.set(LX[2], 1.4, LZ + 0.7); w.add(keyGlint);
    const lockers = [], opened = [];
    for (let i = 0; i < 6; i++) {
      const lk = locker(w, { x: LX[i], z: LZ, rot: 0, ajar: 0 }); lockers.push(lk);
      const cav = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.8), new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 1 })); cav.position.set(0, 0.95, 0.254); lk.add(cav);
      { const sg = sigil(w, SIG[i], { x: 0, y: 1.4, z: 0, nx: 0, nz: 1, size: 0.32 }); sg.parent.remove(sg); lk.userData.door.add(sg); sg.position.set(0.3, 1.4, 0.296); }
      let t = 0;
      w.updaters.push((dt) => { const want = opened[i] ? 1 : 0; t += (want - t) * Math.min(1, dt * 5); lk.userData.door.rotation.y = -t * 1.9; });
      press({ x: LX[i], y: 1.2, z: LZ + 0.62, bw: 0.62, bh: 1.9, bd: 0.4, label: () => 'Open locker', enabled: () => !opened[i], onUse: () => { c.set('lk:' + i, true); game.audio.confirm?.(); } });
      c.on('lk:' + i, (v) => { if (!v || opened[i]) return; opened[i] = true; S.door(0, 0.2); S.squeak(0, 0.08); wrong(i); });
    }
    const wrong = (i) => {
      if (i === 2) { if (c.isHost) c.emit('c3:revealkey'); return; }
      if (i === 0) { sayAll('lt.c3.lk.spiral'); Z.knock({ n: 3 }); }
      if (i === 1) { sayAll('lt.c3.lk.eye'); Z.whisper({}); }
      if (i === 3) { sayAll('lt.c3.lk.star', { priority: 2 }); S.slam(0.45); if (c.isHost) st.noise(15, -26.5, 16); H.stutter(1.4); }
      if (i === 4) { sayAll('lt.c3.lk.hook'); Z.sting(0.5); Z.behind('patient', { role: 'all', dist: 2.6 }); }
      if (i === 5) { sayAll('lt.c3.lk.plain'); Z.partnerWrong(3.5, {}); }
    };
    trip('lockers', { x: 15, y: 1, z: -25, w: 9, h: 3, d: 6 }, () => { sayAll('lt.c3.lockers'); });

    // ================================================================ the Orderly ================================================
    const st = stalker(w, game, H, S, {
      nodes: [{ id: 'c', x: 0, z: -18 }, { id: 'wm', x: -11, z: -18 }, { id: 'w', x: -21, z: -18 }, { id: 'em', x: 11, z: -18 }, { id: 'e', x: 21, z: -18 }, { id: 'wd', x: -15, z: -18 }, { id: 'ed', x: 15, z: -18 }, { id: 'er', x: 15, z: -25.6 }, { id: 'wr', x: -15, z: -23.4 }],
      route: ['c', 'w', 'c', 'e'], start: 'e', sight: 13, hear: 6, pause: 2.2,
    });
    st.hideSpot({ x: -9, z: -16.5, w: 3.6, d: 2.0 }); st.hideSpot({ x: 9, z: -16.5, w: 3.6, d: 2.0 });
    st.hideSpot({ x: 11.5, z: -25.5, w: 2.0, d: 4.2 }); st.hideSpot({ x: 18.9, z: -25.5, w: 1.6, d: 3.8 });
    c.onEvent('c3:page', (to) => { sayAll('lt.c3.page'); S.intercom(); w.after(1.2, () => { S.intercom(); if (c.isHost && to) st.noise(to.x, to.z, 16); }); });
    const Z = scares(w, game, H, S);

    // ================================================================ 5. the key ================================================
    c.on('c3:key', (v) => {
      keyObj.visible = v === 'locker'; keyGlint.intensity = v === 'locker' ? 6 : 0;
      if (v === me) toast('You have the key. G near your partner hands it over.', 'gold');
      if (v === other && R.is('subject') === false) toast(`${c.names[other]} has the key`, 'gold');
    });
    c.onEvent('c3:revealkey', () => {
      if (w._revealed) return; w._revealed = true;
      c.set('c3:key', 'locker');
      sayAll('lt.c3.keyfound', { priority: 2 });
      w.after(1.6, () => R.whisper({ keyholder: 'lt.c3.whisper.take' }, { priority: 2 }));
    });
    const holderIs = (r) => c.get('c3:key', '') === r;
    press({
      x: LX[2], y: 1.2, z: LZ + 0.62, bw: 0.62, bh: 1.9, bd: 0.4, range: 3.4,
      label: () => 'Take the key', enabled: () => c.get('c3:key', '') === 'locker',
      onUse: () => {
        c.set('c3:key', me); game.audio.confirm?.();
        if (R.is('keyholder')) { R.flag('took-key', true); } else { R.flag('took-key', false); R.flag('ch3-subject-took', true); }
        c.emit('c3:keytaken', { by: me });
      },
    });
    c.onEvent('c3:keytaken', (a) => {
      if (w._keyTaken) return; w._keyTaken = true;
      const kh = R.keyholder === a.by;
      Z.blackout(2.4);
      w.after(2.6, () => {
        if (kh) { R.whisper({ keyholder: 'lt.c3.whisper.keep', subject: 'lt.c3.whisper.notyou' }, { priority: 2 }); }
        else { R.whisper({ keyholder: 'lt.c3.whisper.theytook', subject: 'lt.c3.whisper.iktook' }, { priority: 2 }); }
        Z.partnerWrong(4, {});
      });
      w.after(9, () => { sayAll('lt.c3.wheels', { priority: 2 }); if (c.isHost) st.noise(15, -26, 20); });
    });
    // G: hand the key to your partner (they must be close)
    const onKey = (e) => {
      if (e.code !== 'KeyG' || game.state !== 'playing' || c.get('c3:key', '') !== me) return;
      const P = c.partner, g = game.player;
      if (!P.has || P.dead || Math.hypot(P.sx - g.x, P.sz - g.z) > 3.6) { toast('Your partner is too far away', ''); return; }
      c.set('c3:key', other);
      if (R.is('keyholder')) { R.flag('took-key', false); R.flag('ch3-gave-key', true); }
      toast(`You gave ${c.names[other]} the key`, 'good');
    };
    window.addEventListener('keydown', onKey); w.onDispose(() => window.removeEventListener('keydown', onKey));

    // ================================================================ 6. corridor 2 and the archive gate =========================
    room(w, { x: 0, z: -27.5, w: 4.6, d: 13, sides: { s: false, n: false } });
    for (const [z, m] of [[-23, 'buzz'], [-27, 'dying'], [-31, 'steady']]) H.lamp({ x: 0, y: 3.35, z, mode: m, rot: PI / 2, len: 1.3, power: m === 'steady' ? 0.6 : 1 });
    pipes(w, { x0: 1.9, z0: -21.4, x1: 1.9, z1: -33, y: 2.9, n: 2 });
    for (let i = 0; i < 4; i++) { cabinet(w, { x: -1.95, z: -23.4 - i * 0.62, rot: PI / 2 }); }
    cabinet(w, { x: -1.95, z: -29.2, rot: PI / 2, open: 0 }); cabinet(w, { x: -1.95, z: -29.82, rot: PI / 2, drawers: 3 });
    decal(w, { kind: 'drag', seed: 17, x: 0, y: 0.02, z: -26, w: 3, h: 4.6, face: 'floor', rot: 0 }); decal(w, { kind: 'hand', seed: 13, x: 2.14, y: 1.2, z: -25, w: 0.5, h: 0.5, face: 'e' });
    stencil(w, 'ARCHIVE →', { x: 2.12, y: 2.5, z: -27, rot: -PI / 2, width: 2.4, size: 0.4 });
    trip('corr2', { x: 0, y: 1, z: -24.5, w: 4.4, h: 3, d: 1.2 }, () => { sayAll('lt.c3.corr2'); });

    // antechamber = the Plan Room
    room(w, { x: 0, z: -41, w: 16, d: 14, sides: { n: false }, doors: { s: [{ c: 0, w: 1.8 }] }, floorKind: 'tile', wallKind: 'tile' });
    const D1 = door(w, { x: 0, z: -34, along: 'x', width: 1.8, key: 'gate', locked: true, label: 'archive gate', game });
    box(w, { x: 1.75, y: 1.25, z: -33.78, w: 0.4, h: 0.6, d: 0.08, kind: 'rust', color: 0x1b2022 });
    const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.06, 14), new THREE.MeshBasicMaterial({ color: 0x000000 })); keyhole.position.set(1.75, 1.27, -33.73); w.add(keyhole);
    press({
      x: 1.75, y: 1.3, z: -33.5, bw: 0.55, bh: 1.4, bd: 0.4, label: () => (D1.locked ? (holderIs(me) ? 'Use the key' : 'Keyhole') : 'Keyhole'), enabled: () => D1.locked,
      onUse: (g) => { if (holderIs(me)) { D1.unlock(); D1.setOpen(true); c.emit('c3:gate'); } else if (c.get('c3:key', '') === other) g.say?.('lt.c3.gate.theyhave', { priority: 1 }); else g.say?.('lt.c3.gate.nokey', { priority: 1 }); },
    });
    c.onEvent('c3:gate', () => { if (w._gate) return; w._gate = true; S.door(0, 0.35); sayAll('lt.c3.gateopen', { priority: 2 }); R.flag('took-key', c.get('c3:key', '') === R.keyholder); });
    H.lamp({ x: -3, y: 3.35, z: -39, mode: 'buzz', len: 1.2 }); H.lamp({ x: 3.5, y: 3.35, z: -44, mode: 'dying', len: 1.2 }); H.lamp({ x: 0, y: 3.35, z: -36, mode: 'steady', power: 0.55, len: 0.9 });
    stencil(w, 'PLAN ROOM', { x: 4.2, y: 2.7, z: -47.82, rot: 0, width: 3.4, size: 0.42 });
    decal(w, { kind: 'puddle', seed: 14, x: 3, y: 0.025, z: -42, w: 3, h: 3 }); decal(w, { kind: 'drag', seed: 20, x: 0, y: 0.02, z: -45, w: 3, h: 3.4, face: 'floor', rot: 1.57 });
    decal(w, { kind: 'splat', seed: 18, x: -2, y: 0.02, z: -38, w: 2, h: 2 }); decal(w, { kind: 'scratch', seed: 5, x: 7.84, y: 1.5, z: -40, w: 1.6, h: 1.6, face: 'e' });
    bench(w, { x: 6.9, z: -43, rot: PI / 2 }); cabinet(w, { x: 7.5, z: -36.8, rot: -PI / 2 }); cabinet(w, { x: 7.5, z: -37.45, rot: -PI / 2, drawers: 3 });
    wheelchair(w, { x: -6, z: -37, rot: 2.2 });
    checkpoint(w, { x: 4, z: -41 });
    trip('ante', { x: 0, y: 1, z: -38, w: 15, h: 3, d: 4 }, () => { sayAll('lt.c3.ante', { priority: 2 }); });

    // ================================================================ 7-9. the archive maze ====================================
    room(w, { x: 0, z: -60, w: 28, d: 24, doors: { s: [{ c: 0, w: 2.4 }], n: [{ c: 0, w: 2.4 }] }, floorKind: 'concrete', wallKind: 'concrete' });
    // lamps: mostly dead, a couple dying, so the torch does the work
    for (const [c0, r0, m] of [[1, 1, 'dying'], [5, 0, 'dead'], [3, 2, 'dead'], [5, 3, 'dying'], [1, 4, 'dead'], [4, 5, 'dead'], [0, 3, 'dead']]) H.lamp({ x: CX(c0), y: 3.35, z: CZ(r0), mode: m, len: 1.0, power: 0.8 });
    const bankEdges = BANKS.flatMap((b) => [b.X, b.Y]);
    let seed = 0;
    for (let cc = 0; cc < 6; cc++) for (let rr = 0; rr < 6; rr++) {
      const e = { t: 'E', c: cc, r: rr };
      if (MAZE.E[cc][rr] === '0' && !bankEdges.some((q) => sameEdge(q, e))) { const p = edgeCentre(e); shelf(w, { x: p.x, z: p.z, len: 3.8, along: 'z', seed: seed++ % 7 }); }
    }
    for (let cc = 0; cc < 7; cc++) for (let rr = 0; rr < 5; rr++) {
      const e = { t: 'N', c: cc, r: rr };
      if (MAZE.N[cc][rr] === '0' && !bankEdges.some((q) => sameEdge(q, e))) { const p = edgeCentre(e); shelf(w, { x: p.x, z: p.z, len: 3.8, along: 'x', seed: seed++ % 7 }); }
    }
    const bankVerts = BANKS.map((b) => { const p = edgeCentre(b.X), q = edgeCentre(b.Y); return { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 }; });
    for (let k = 0; k < 6; k++) for (let j = 0; j < 5; j++) {
      const px = CX(k) + 2, pz = CZ(j) - 2;
      if (bankVerts.some((v) => Math.abs(v.x - px) < 0.1 && Math.abs(v.z - pz) < 0.1)) continue;
      pillar(w, { x: px, z: pz });
    }
    // the sliding banks
    const bank = BANKS.map((b, i) => {
      const p = edgeCentre(b.X), q = edgeCentre(b.Y);
      const S0 = shelf(w, { x: p.x, z: p.z, len: 4.2, along: p.along, seed: 3 + i, sliding: true });
      const post = railPost(w, { x: bankVerts[i].x, z: bankVerts[i].z, label: b.id });
      const B = { id: b.id, i, k: 0, want: false, shelf: S0, p, q, post, openedAt: -99, blocked: false };
      c.on('bank:' + i, (v) => { const nv = !!v; if (nv !== B.want) { B.want = nv; B.openedAt = w.t; S.scrape(0, 0.1); S.groan?.(0.05); } });
      return B;
    });
    const footprintHit = (B, cx, cz) => {
      const hx = B.p.along === 'x' ? 2.1 : 0.35, hz = B.p.along === 'x' ? 0.35 : 2.1, g = game.player, P = c.partner;
      const hit = (px, pz) => Math.abs(px - cx) < hx + 0.55 && Math.abs(pz - cz) < hz + 0.55;
      return hit(g.x, g.z) || (P.has && !P.dead && hit(P.sx, P.sz));
    };
    let phase = 1; c.on('c3:phase', (v) => { phase = v | 0 || 1; });
    w.updaters.push((dt) => {
      for (const B of bank) {
        const tk = B.want ? 1 : 0;
        if (B.k !== tk) {
          const nk = B.k + Math.sign(tk - B.k) * Math.min(Math.abs(tk - B.k), dt * 0.7);
          const cx = B.p.x + (B.q.x - B.p.x) * nk, cz = B.p.z + (B.q.z - B.p.z) * nk;
          B.blocked = footprintHit(B, cx, cz);
          if (!B.blocked) { B.k = nk; B.shelf.setCentre(cx, cz); }
        }
        B.post.set(B.k > 0.5);
        if (c.isHost && phase === 2 && B.want && w.t - B.openedAt > HOLD && B.k >= 0.99) c.set('bank:' + B.i, false);
      }
    });
    // the Plan Room console (south) and the north console (vestibule): the same three levers, the same plan
    const drawPlan = (flip) => (g, cw, ch, t) => {
      const sc = 15, P = (wx, wz) => (flip ? [8 + (14 - wx) * sc, 12 - (wz + 48) * sc] : [8 + (wx + 14) * sc, 12 + (wz + 72) * sc]);
      g.fillStyle = '#041412'; g.fillRect(0, 0, cw, ch);
      g.strokeStyle = 'rgba(80,255,200,0.07)'; g.lineWidth = 1; for (let k = 0; k <= 28; k += 4) { const a = P(-14 + k, -48), b2 = P(-14 + k, -72); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b2[0], b2[1]); g.stroke(); }
      g.strokeStyle = '#38e0b4'; g.lineWidth = 3; g.lineCap = 'round';
      const seg = (x0, z0, x1, z1) => { const a = P(x0, z0), b2 = P(x1, z1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b2[0], b2[1]); g.stroke(); };
      const out = [P(-14, -48), P(14, -72)]; g.strokeRect(Math.min(out[0][0], out[1][0]), Math.min(out[0][1], out[1][1]), Math.abs(out[1][0] - out[0][0]), Math.abs(out[1][1] - out[0][1]));
      for (let cc = 0; cc < 6; cc++) for (let rr = 0; rr < 6; rr++) { const e = { t: 'E', c: cc, r: rr }; if (MAZE.E[cc][rr] === '0' && !bankEdges.some((q) => sameEdge(q, e))) { const p = edgeCentre(e); seg(p.x, p.z - 2, p.x, p.z + 2); } }
      for (let cc = 0; cc < 7; cc++) for (let rr = 0; rr < 5; rr++) { const e = { t: 'N', c: cc, r: rr }; if (MAZE.N[cc][rr] === '0' && !bankEdges.some((q) => sameEdge(q, e))) { const p = edgeCentre(e); seg(p.x - 2, p.z, p.x + 2, p.z); } }
      // entrance and exit marks (the gaps in the frame)
      g.fillStyle = '#041412'; { const a = P(-1.2, -48), b2 = P(1.2, -48), a2 = P(-1.2, -72), b3 = P(1.2, -72); g.fillRect(Math.min(a[0], b2[0]), a[1] - 3, Math.abs(b2[0] - a[0]), 6); g.fillRect(Math.min(a2[0], b3[0]), a2[1] - 3, Math.abs(b3[0] - a2[0]), 6); }
      g.fillStyle = '#9fe9d2'; g.font = '700 13px "Courier New", monospace'; g.textAlign = 'center'; { const a = P(0, -47), b2 = P(0, -73); g.fillText('IN', a[0], a[1] + (flip ? -2 : 12)); g.fillText('OUT', b2[0], b2[1] + (flip ? 12 : -2)); }
      // banks
      for (const B of bank) {
        const bx = B.p.x + (B.q.x - B.p.x) * B.k, bz = B.p.z + (B.q.z - B.p.z) * B.k, a = B.p.along === 'x';
        const ax = P(a ? B.q.x - 2 : B.q.x, a ? B.q.z : B.q.z - 2), bx2 = P(a ? B.q.x + 2 : B.q.x, a ? B.q.z : B.q.z + 2);
        g.strokeStyle = 'rgba(255,190,60,0.35)'; g.setLineDash([4, 5]); g.lineWidth = 2; g.beginPath(); g.moveTo(ax[0], ax[1]); g.lineTo(bx2[0], bx2[1]); g.stroke(); g.setLineDash([]);
        const aa = P(a ? bx - 2.1 : bx, a ? bz : bz - 2.1), bb = P(a ? bx + 2.1 : bx, a ? bz : bz + 2.1);
        const open = B.k > 0.5; g.strokeStyle = open ? '#52ff9a' : '#ff5a3a'; g.lineWidth = 5; g.beginPath(); g.moveTo(aa[0], aa[1]); g.lineTo(bb[0], bb[1]); g.stroke();
        const lp = P(bx, bz); g.fillStyle = '#ffd36a'; g.font = '800 16px "Courier New", monospace'; g.fillText(B.id, lp[0] + (a ? 0 : 14), lp[1] + (a ? -9 : 5));
      }
      // people
      const dot = (wx, wz, col, label, ghost) => { if (wx < -14 || wx > 14 || wz > -48 || wz < -72) return; const p = P(wx, wz); g.fillStyle = col; g.globalAlpha = ghost ? 0.55 + 0.4 * Math.sin(t * 30) : 1; g.beginPath(); g.arc(p[0], p[1], 6, 0, 7); g.fill(); g.globalAlpha = 1; g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.arc(p[0], p[1], 11 + Math.sin(t * 5) * 2, 0, 7); g.stroke(); g.font = '700 11px "Courier New", monospace'; g.fillStyle = col; g.fillText(label, p[0], p[1] - 16); };
      const gp = game.player, pp = c.partner, inMaze = (x, z) => x > -14 && x < 14 && z < -48 && z > -72;
      let any = false;
      if (inMaze(gp.x, gp.z)) { dot(gp.x, gp.z, '#ffffff', (c.names[me] || '').slice(0, 8)); any = true; }
      if (pp.has && !pp.dead && inMaze(pp.sx, pp.sz)) { dot(pp.sx, pp.sz, '#7fe8ff', (c.names[other] || '').slice(0, 8)); any = true; }
      if (wrongUntil > t) { dot(CX(3) + Math.sin(t * 2) * 6, CZ(2) + 1.5, '#7fe8ff', (c.names[other] || '').slice(0, 8) + ' ?', true); any = true; }
      // side panel
      g.fillStyle = '#0a2a24'; g.fillRect(440, 0, cw - 440, ch);
      g.fillStyle = '#9fe9d2'; g.font = '800 15px "Courier New", monospace'; g.textAlign = 'left'; g.fillText('RECORDS', 448, 28); g.fillText('STACKS', 448, 48);
      g.font = '700 13px "Courier New", monospace';
      for (const B of bank) { const y = 100 + B.i * 36; g.fillStyle = B.k > 0.5 ? '#52ff9a' : '#ff6a4a'; g.fillText(`${B.id}  ${B.blocked ? 'JAM' : B.k > 0.97 ? 'OPEN' : B.k < 0.03 ? 'SHUT' : '...'}`, 448, y); }
      g.fillStyle = '#9fe9d2'; g.fillText(phase === 2 ? 'RAILS TIRED' : 'RAILS OK', 448, 240); if (phase === 2) { g.fillStyle = '#ffb04a'; g.fillText(`HOLD ${HOLD}s`, 448, 258); }
      if (!any) { g.fillStyle = '#9fe9d2'; g.font = '700 15px "Courier New", monospace'; g.fillText('NO SIGNAL', 448, 330); }
      if (wrongUntil > t) { g.fillStyle = '#ff6a4a'; g.fillText('2 SIGNALS', 448, 350); }
      g.globalAlpha = 0.16; g.fillStyle = '#000'; for (let y = 0; y < ch; y += 3) g.fillRect(0, y, cw, 1); g.globalAlpha = 1;
      if (Math.sin(t * 1.3) > 0.985) { g.fillStyle = 'rgba(120,255,220,0.18)'; g.fillRect(0, (t * 90) % ch, cw, 8); }
    };
    let wrongUntil = 0;
    const consoles = [
      { rig: leverConsole(w, { x: -4.8, z: -47.37, nx: 0, nz: 1 }), mon: monitor(w, { x: -4.8, y: 2.15, z: -47.78, nx: 0, nz: 1, draw: drawPlan(false) }) },
      { rig: leverConsole(w, { x: -4.8, z: -72.63, nx: 0, nz: -1 }), mon: monitor(w, { x: -4.8, y: 2.15, z: -72.22, nx: 0, nz: -1, draw: drawPlan(true) }) },
    ];
    for (const K of consoles) {
      for (let i = 0; i < 3; i++) {
        const lv = K.rig.levers[i];
        press({ x: lv.x, y: 1.2, z: lv.z, bw: 0.6, bh: 1.2, bd: 0.5, label: () => `Shelf ${bank[i].id}: ${bank[i].want ? 'send back' : 'slide open'}`, onUse: () => { c.set('bank:' + i, !bank[i].want); S.squeak(0, 0.08); game.audio.confirm?.(); } });
      }
    }
    let monT = 0;
    w.updaters.push((dt) => {
      for (const K of consoles) { K.rig.tick(dt); for (let i = 0; i < 3; i++) K.rig.set(i, bank[i].want); }
      monT -= dt; if (monT <= 0) { monT = 0.12; for (const K of consoles) K.mon.redraw(w.t); }
    });
    c.onEvent('c3:ghost', () => { wrongUntil = w.t + 7; });

    // ---- walker / reader beats
    trip('mazeIn1', { x: 0, y: 1, z: -49.3, w: 3, h: 3, d: 2.2 }, (who) => {
      tell(who, 'lt.c3.walk.in', { priority: 2 }); tell(who === 'p1' ? 'p2' : 'p1', 'lt.c3.read.in', { priority: 2 });
    });
    trip('mazeStand', { x: CX(3), y: 1, z: CZ(4), w: 3.4, h: 3, d: 3.4 }, (who) => { Z.stand('orderly', CX(1), CZ(4), { role: who, dur: 9 }); w.after(0.2, () => { if (who === me) H.stutter(2.5); }); });
    trip('mazeGhost', { x: CX(2), y: 1, z: CZ(2), w: 3.4, h: 3, d: 3.4 }, (who) => {
      const reader = who === 'p1' ? 'p2' : 'p1';
      c.emit('c3:ghost'); tell(reader, 'lt.c3.read.ghost', { priority: 2 }); S.whisper(me === reader ? -0.8 : 0.8, 1.4);
      Z.behind('wrong', { role: reader, dist: 3.4, dur: 14 });
    });
    trip('vest', { x: 0, y: 1, z: -75.5, w: 5, h: 3, d: 3 }, (who) => {
      c.set('c3:phase', 2);
      if (c.isHost) for (let i = 0; i < 3; i++) c.set('bank:' + i, false);
      tell(who, 'lt.c3.across', { priority: 2 }); tell(who === 'p1' ? 'p2' : 'p1', 'lt.c3.swap', { priority: 2 });
    });
    trip('mazeRush', { x: CX(0), y: 1, z: CZ(1), w: 3.4, h: 3, d: 3.4 }, (who) => {
      Z.rush('orderly', { role: who, dist: 12, dur: 0.7, angle: 0 });
    }, () => phase === 2);

    // ================================================================ vestibule and the vault ===================================
    room(w, { x: 0, z: -79, w: 16, d: 14, sides: { s: false }, doors: { n: [{ c: 0, w: 2.4 }] }, floorKind: 'tile', wallKind: 'tile' });
    const D2 = door(w, { x: 0, z: -86, along: 'x', width: 2.4, key: 'vault', locked: true, label: 'vault shutter', game });
    H.lamp({ x: -3, y: 3.35, z: -78, mode: 'dying', len: 1.2 }); H.lamp({ x: 4, y: 3.35, z: -82, mode: 'buzz', len: 1.1 }); H.lamp({ x: 0, y: 3.35, z: -76, mode: 'steady', power: 0.5, len: 0.9 });
    stencil(w, 'NORTH · STACKS', { x: 4.6, y: 2.7, z: -72.18, rot: PI, width: 3.4, size: 0.4 });
    bench(w, { x: -7.0, z: -80, rot: PI / 2 }); cabinet(w, { x: 7.5, z: -77, rot: -PI / 2 }); cabinet(w, { x: 7.5, z: -77.65, rot: -PI / 2 });
    barWindow(w, { x: 7.82, y: 1.9, z: -81.5, rot: -PI / 2 });
    decal(w, { kind: 'puddle', seed: 16, x: 3, y: 0.025, z: -79, w: 3.2, h: 3.2 }); decal(w, { kind: 'drag', seed: 22, x: 0, y: 0.02, z: -83, w: 3.4, h: 2.6, face: 'floor', rot: 1.57 }); decal(w, { kind: 'hand', seed: 15, x: -7.84, y: 1.2, z: -76, w: 0.5, h: 0.5, face: 'w' });
    box(w, { x: 2.5, y: 1.25, z: -85.78, w: 0.4, h: 0.6, d: 0.08, kind: 'rust', color: 0x1b2022 });
    press({
      x: 2.55, y: 1.3, z: -85.5, bw: 0.55, bh: 1.4, bd: 0.4, label: () => (holderIs(me) ? 'Use the key' : 'Keyhole'), enabled: () => D2.locked,
      onUse: (g) => { if (holderIs(me)) { D2.unlock(); D2.setOpen(true); c.emit('c3:vault'); } else g.say?.(c.get('c3:key', '') === other ? 'lt.c3.gate.theyhave' : 'lt.c3.gate.nokey', { priority: 1 }); },
    });
    c.onEvent('c3:vault', () => {
      if (w._vault) return; w._vault = true; S.door(0, 0.35); sayAll('lt.c3.vaultopen', { priority: 2 });
      const holder = c.get('c3:key', ''); R.flag('took-key', holder === R.keyholder);
    });
    trip('vestBoth', { x: 0, y: 1, z: -79, w: 14, h: 3, d: 11 }, () => { w.after(3, () => { /* both of you in the north: whoever was last still counts */ }); });
    checkpoint(w, { x: -3, z: -80 });

    room(w, { x: 0, z: -96, w: 16, d: 20, sides: { s: false }, floorKind: 'tile', wallKind: 'tile' });
    H.lamp({ x: 0, y: 3.35, z: -92, mode: 'steady', power: 0.7 }); H.lamp({ x: -4, y: 3.35, z: -97, mode: 'dying' }); H.lamp({ x: 4, y: 3.35, z: -97, mode: 'buzz' }); H.lamp({ x: 0, y: 3.35, z: -102, mode: 'strobe', len: 1.4 });
    for (let i = 0; i < 6; i++) { cabinet(w, { x: -7.5, z: -90 - i * 0.62, rot: PI / 2, open: i === 3 ? 0 : -1 }); cabinet(w, { x: 7.5, z: -90 - i * 0.62, rot: -PI / 2 }); }
    desk(w, { x: 0, z: -96, rot: 0 }); desk(w, { x: -2.2, z: -96, rot: 0, papers: false });
    stencil(w, 'THE VAULT', { x: 0, y: 2.95, z: -85.82, rot: 0, width: 2.6, size: 0.4 });
    decal(w, { kind: 'puddle', seed: 18, x: 3, y: 0.025, z: -100, w: 3, h: 3 }); decal(w, { kind: 'splat', seed: 24, x: -3, y: 0.02, z: -93, w: 2.4, h: 2.4 }); decal(w, { kind: 'drag', seed: 26, x: 0, y: 0.02, z: -101, w: 3.4, h: 2.6, face: 'floor', rot: 1.57 });
    // the last file: each of you reads the OTHER kind of document from the one you read before
    paper({
      x: 0.1, y: 0.82, z: -96, title: 'CASE FILE 0417-B · CLOSED', size: 0.34,
      html: {
        get keyholder() { const n = names(); const held = c.get('c3:key', ''); return `<b>(hand-written, in a shaking hand)</b><p>I will not remember this. If you are reading it you are me and you are holding the key. Put it down. Put it down.</p><p>The log says I held it the whole time. The log is lying about who "I" is. ${held === R.keyholder ? 'The key is still in your hand. Look at your hand.' : 'The key left your hand. Somebody else is holding it now. Do not ask who.'}</p><p>When the tide comes in, the one beside you will say <b>${n.O}</b> is not their name. Believe them.</p>`; },
        get subject() { const n = names(); const held = c.get('c3:key', ''); return `<b>DISCHARGE SUMMARY</b> <i>(typed)</i><p>Treatment of <b>${n.M}</b> complete. Memory consolidation scheduled. Return to Ward B for re-sedation.</p><p><b>Key log:</b> ${held === R.keyholder ? 'held by attending throughout.' : 'passed to patient at 03:11 (irregular).'} <b>Attending:</b> ${n.O}.</p><p style="opacity:.8">[Margin: ${n.M} has been signing as attending since 02:41. See also: ${n.O}. See also: ${n.M}.]</p>`; },
      },
      onRead: () => { sayAll('lt.c3.final'); },
    });
    exitDoor(w, { x: 0, z: -105.7, rot: 0 });
    trip('vault', { x: 0, y: 1, z: -90.5, w: 6, h: 3, d: 2 }, () => { sayAll('lt.c3.vault', { priority: 2 }); w.after(8, () => { sayAll('lt.c3.wrong2'); Z.partnerWrong(5, {}); }); });
    trip('exitwatch', { x: 0, y: 1, z: -101, w: 8, h: 3, d: 2.2 }, () => { Z.blackout(1.8); w.after(1.9, () => { Z.stand('orderly', 0, -104.2, { role: 'all', dur: 6 }); Z.sting(0.4); sayAll('lt.c3.exit'); }); });

    // ================================================================ bots ========================================================
    const dist2 = (a, b, x, z) => Math.hypot(a - x, b - z);
    const partnerNear = (x, z, r) => { const P = c.partner; return P.has && dist2(P.sx, P.sz, x, z) < r; };
    const meNear = (x, z, r) => { const g = game.player; return dist2(g.x, g.z, x, z) < r; };
    const cellOf = (idx) => ({ x: CX(ROUTE[idx][0]), z: CZ(ROUTE[idx][1]) });
    const walkSteps = (controllerWaits) => {
      const out = [];
      for (let i = 0; i < ROUTE.length; i++) {
        const p = cellOf(i);
        const bi = BANK_AT.indexOf(i);
        if (i === 0) out.push({ x: 0, z: -47.2, r: 0.8 });
        if (bi >= 0) out.push({ x: p.x, z: p.z, r: 0.5, until: () => bank[bi].k > 0.97 });
        else out.push({ x: p.x, z: p.z, r: 0.7 });
      }
      out.push({ x: 0, z: -76.5, r: 0.8 }); void controllerWaits;
      return out;
    };
    const leverSteps = (K, doneCheck) => {
      const out = [];
      for (let i = 0; i < 3; i++) {
        const lv = K.rig.levers[i], cell = cellOf(BANK_AT[i] - 1 >= 0 ? BANK_AT[i] - 1 : 0);
        out.push({ x: lv.x, z: lv.z, r: 0.6, until: () => partnerNear(cell.x, cell.z, 4.2) || bank[i].want || doneCheck() });
        out.push({ x: lv.x, z: lv.z, r: 0.6, use: true, until: () => bank[i].want || doneCheck() });
      }
      return out;
    };
    const dialSteps = [0, 1, 2, 3].map((i) => ({ x: 2.05 + i * 0.4, z: -5.5, r: 1.15, use: true, until: () => dial[i] === CODE[i] }));
    const keySpot = { x: LX[2], z: LZ + 0.62 };
    const common = [{ x: 0, z: -7.6, r: 0.8 }, { x: 0, z: -24, r: 1.0 }];
    const keyholder = [
      ...dialSteps,
      { x: 0, z: -4, r: 1, until: () => !D0.locked && D0.k > 0.9 },
      ...common,
      { x: 15, z: -18.3, r: 1.0 }, { x: 15, z: -22.6, r: 1.0 },
      { x: keySpot.x, z: keySpot.z, r: 1.0, use: true, until: () => opened[2] },
      { x: keySpot.x, z: keySpot.z, r: 1.0, use: true, until: () => holderIs(me) },
      { x: 15, z: -22.6, r: 1.0 }, { x: 15, z: -18.3, r: 1.0 }, { x: 0, z: -20, r: 1.0 }, { x: 0, z: -31.5, r: 1.0 },
      { x: 1.75, z: -32.2, r: 0.9, use: true, until: () => !D1.locked },
      { x: 0, z: -41, r: 1.0 },
      ...leverSteps(consoles[0], () => phase === 2),
      { x: consoles[0].rig.levers[1].x, z: consoles[0].rig.levers[1].z, r: 0.8, until: () => phase === 2 },
      ...walkSteps(),
      { x: 2.55, z: -84.2, r: 0.9, use: true, until: () => !D2.locked },
      { x: 0, z: -98, r: 1.0 }, { x: 0, z: -104, r: 1.0 },
    ];
    const subject = [
      { x: -1.0, z: -2.0, r: 1, until: () => !D0.locked && D0.k > 0.9 },
      ...common,
      { x: 0, z: -31.5, r: 1.0 },
      { x: 0, z: -31.5, r: 1.0, until: () => !D1.locked },
      { x: 0, z: -41, r: 1.0 },
      { x: 0, z: -42, r: 1.0, until: () => partnerNear(consoles[0].rig.levers[1].x, consoles[0].rig.levers[1].z, 2.5) },
      ...walkSteps(),
      { x: consoles[1].rig.levers[1].x, z: consoles[1].rig.levers[1].z, r: 0.8, until: () => phase === 2 && bank.every((b) => !b.want) },
      ...leverSteps(consoles[1], () => false),
      { x: 0, z: -78, r: 1.0 },
      { x: 0, z: -78, r: 1.0, until: () => !D2.locked },
      { x: 0, z: -98, r: 1.0 }, { x: 0, z: -104, r: 1.0 },
    ];
    botSteps(w, { [R.keyholder]: keyholder, [R.subject]: subject });
    void toast; void other; void front; void mineIf; void gurney; void keyholder;
  },
};
