import * as THREE from 'three';
import { stalker } from './stalker.js';
import { scares } from './scare.js';
import { roles } from './roles.js';
import { figure } from './figure.js';
import { horrorEnv, exitDoor, checkpoint, door, room, wall, hp, box, decal, locker, curtain, gurney, wheelchair, pipes, desk, barWindow, stencil } from './kit.js';
import { bench, cabinet, shelf, leverConsole, monitor } from './records-kit.js';
import { wainscot, rug, portrait, chandelier, wallClock, pedestal, column, chair, longTable, safeBox, depositBoxes, maintPanel, WIRE, projector, mirrorGlass, privateHud, glowSpot } from './director-kit.js';
import { botSteps } from '../coop/kit.js';

// Chapter 7 — The Director. The grand office wing. The roles are REVEALED, privately and differently, on each player's own screen:
//   a Study full of papers (three documents each, different per role) · a Mirror Room whose glass shows only you (a different figure each) ·
//   a Screening Room whose film is a different film for each of you · the Night Desk finally speaks plainly.
// Then the betrayal. The patient (the Subject) is sent into the archive vault to switch on the cameras; at that moment the Keyholder alone gets a
// private choice (a bolt lever by the vault door and a 90-second timer that only they can see): lock the Subject in, or not. Whichever they choose the
// chapter can be finished:
//   locked   - the Keyholder runs the Director's private wing alone while the Orderly hunts, and gets the safe's last digit from an override card;
//              the Subject, sealed in, breaks the relay out of the vault (a ledger, a deposit box, a brass opener, a screw cover, three plugs, an overload).
//   unlocked - the Subject is the watcher at the camera console (a live map of the wing, a bell that lures the Orderly) and holds the safe's last digit
//              (the dose, from their own drug chart) that the Keyholder must be told over voice.
// Flags: locked-in (the Keyholder bolted the door), ch7-sabotaged (the Subject broke out), ch7-released (the Keyholder drew the bolt), ch7-took-key.
// Beats: 1 lobby, two wristband readers · 2 Gallery of Directors (the Orderly patrols) · 3 Study, three papers each · 4 Mirror Room · 5 Screening Room ·
// 6 the Night Desk drops its mask · 7 Strongroom Lobby, the camera console and the bolt · 8 the private wing (Boardroom, Library, Chapel, Safe Room) ·
// 9 the vault (sabotage) · 10 the key, the Chapel door and the way out.

const esc = (s) => String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
const PI = Math.PI;
const HT = 4.2;
const LY = HT - 0.05;
const CODE = [5, 2, 9, 6];                              // minutes · index · hymn · dose
const SOLUTION = [1, 2, 0];                             // BELL blue · EARTH yellow · BED red
const qs = new URLSearchParams(location.search);
const BOT_LOCKS = qs.get('lock') !== '0';               // bots lock the Subject in unless ?lock=0
const WINDOW = window.__noRender ? 14 : 90;             // seconds the Keyholder has to decide
const REEL = 80;                                        // length of the film

export default {
  id: 'lowtide7',
  name: 'The Director',
  music: 'l1',
  horror: true,
  deathRule: 'self',
  completeQuip: 'Director\'s wing cleared. Thank you for your cooperation, both of you. One of you is lying about that.',
  titleCam: { center: [4, 2, -48], radius: 34, height: 18 },

  build(w, game) {
    const H = horrorEnv(w, game, { fogColor: 0x0b0908, density: 0.05, ambientSky: 0x4a4038, ambient: 0.62 });
    const c = w.coop, me = c.me, other = c.other;
    w.spawn = { x: me === 'p1' ? -2.2 : 2.2, y: 0, z: 2.5, yaw: 0 };
    w.respawn = { ...w.spawn };
    const R = roles(w, game);
    const S = H.S;
    const Z = scares(w, game, H, S);
    const tell = (r, k, o) => c.tell(r, k, o);
    const sayAll = (k, o) => tell('all', k, o);
    const whisper = (k, s, o = { priority: 2 }) => R.whisper({ keyholder: k, subject: s }, o);
    const names = () => ({ M: esc(c.names[me]), O: esc(c.names[other]) });
    const toast = (t, kind = '') => game.ui?.toast?.(t, kind);
    const host = c.isHost;
    R.flag('locked-in', false);

    // ================================================================ helpers ====================================================
    const paper = ({ x, y, z, rot = 0, title, html, label = 'Read', onRead, size = 0.3, face = null, ix = x, iz = z, enabled }) => {
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 1.3), new THREE.MeshStandardMaterial({ color: 0xcfc8b0, roughness: 1, emissive: 0x2a2514, emissiveIntensity: 0.55 }));
      pm.position.set(x, y, z); if (face) pm.rotation.set(0, Math.atan2(face.nx, face.nz), 0); else pm.rotation.set(-PI / 2 + 0.05, 0, rot); w.add(pm);
      let read = false;
      const pick = () => (typeof html === 'string' ? html : (html[c.me] ?? html[R.mine] ?? html.all ?? ''));
      const it = w.interactable({
        x: ix, y: y + 0.35, z: iz, w: 0.8, h: 1.7, d: 0.8, range: 3.2, pad: 0.1, enabled,
        label: () => (read ? 'Read again' : label),
        onUse: async (g) => { const { readModal } = await import('../hotel/escape-kit.js'); readModal(g, { title, html: pick() }); if (!read) { read = true; onRead?.(); } },
      });
      void it; return pm;
    };
    const press = ({ x, y = 1.3, z, bw = 0.6, bh = 1.6, bd = 0.6, label, enabled, onUse, range = 3.2 }) => w.interactable({ x, y, z, w: bw, h: bh, d: bd, range, pad: 0.1, label, enabled, onUse });
    const trip = (name, bx, fn, cond) => {
      let fired = false;
      c.onEvent('c7:' + name, (a) => { if (fired) return; fired = true; fn(a?.who || 'p1'); });
      c.zone({ ...bx, need: 'any', shrink: 0 }).onChange((zn) => { if (zn.active && !fired && (!cond || cond())) c.emit('c7:' + name, { who: zn.p1 && !zn.p2 ? 'p1' : zn.p2 && !zn.p1 ? 'p2' : (zn.mine ? me : other) }); });
    };
    const lamps = (list, y = LY) => list.map(([x, z, mode, power = 1, len = 1.3, rot = 0]) => H.lamp({ x, y, z, mode, power, len, rot }));
    const confirm = () => game.audio.confirm?.();
    const hostDo = (fn) => { if (host) fn(); };

    // ================================================================ 1. lobby =================================================
    room(w, { x: 0, z: 0, w: 22, d: 14, h: HT, doors: { n: [{ c: 0, w: 2.6 }] }, floorKind: 'tile', wallKind: 'plaster' });
    for (const [x, len] of [[-6.15, 9.7], [6.15, 9.7]]) wainscot(w, { x, z: -7, len, along: 'x', side: 1 });
    wainscot(w, { x: -11, z: 0, len: 14, along: 'z', side: 1 }); wainscot(w, { x: 11, z: 0, len: 14, along: 'z', side: -1 }); wainscot(w, { x: 0, z: 7, len: 22, along: 'x', side: -1 });
    rug(w, { x: 0, z: -1, w: 5.6, d: 11 });
    chandelier(w, { x: 0, y: 3.1, z: 0.5 });
    stencil(w, 'CHAPTER 7', { x: -6.2, y: 3.5, z: -6.82, rot: 0, width: 3, size: 0.4 }); stencil(w, 'THE DIRECTOR', { x: -6.2, y: 2.85, z: -6.82, rot: 0, width: 4, size: 0.34 });
    stencil(w, 'DIRECTOR\'S WING · STAFF ONLY', { x: 0, y: 3.55, z: 6.82, rot: PI, width: 5, size: 0.3 });
    portrait(w, { x: 6.5, y: 2.2, z: -6.82, seed: 5, plaque: 'FOUNDER\nE. HALLOWAY 1931' }); portrait(w, { x: 9.2, y: 2.2, z: -6.82, seed: 8, plaque: 'BENEFACTOR\nTHE TIDE COMMITTEE' });
    desk(w, { x: -3.6, z: -3.9, rot: 0 }); desk(w, { x: 3.6, z: -3.9, rot: 0 }); chair(w, { x: -3.6, z: -4.9, rot: PI }); chair(w, { x: 3.6, z: -4.9, rot: PI });
    bench(w, { x: -9.5, z: 3.6, rot: PI / 2 }); bench(w, { x: 9.5, z: 3.6, rot: PI / 2 }); wheelchair(w, { x: 7.5, z: 5.2, rot: 3.5 });
    barWindow(w, { x: -10.82, y: 2.2, z: 4.5, rot: PI / 2, width: 1.4, height: 1.6 });
    pipes(w, { x0: -10.4, z0: 6, x1: -10.4, z1: -6, y: 3.7, n: 2 });
    decal(w, { kind: 'puddle', seed: 4, x: 2.8, y: 0.025, z: 3.0, w: 2.8, h: 2.8 }); decal(w, { kind: 'drag', seed: 11, x: -1, y: 0.02, z: 1.5, w: 3.6, h: 2.2, face: 'floor', rot: 1.57 });
    decal(w, { kind: 'hand', seed: 6, x: 10.84, y: 1.3, z: 2.2, w: 0.5, h: 0.5, face: 'e' }); decal(w, { kind: 'scratch', seed: 9, x: -10.84, y: 1.7, z: -3.6, w: 1.5, h: 1.5, face: 'w' });
    lamps([[-4, 0, 'buzz', 0.9], [4.5, 3, 'dying', 0.9], [-5, 4.5, 'dead'], [0, -4.5, 'steady', 0.6, 1.1], [7, -3, 'buzz', 0.7]]);
    checkpoint(w, { x: 0, z: -1.6 });
    // two wristband readers, one at each end of the lobby: the door needs both
    const readerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3dff9a).multiplyScalar(1.5), toneMapped: false });
    for (const [sx, who] of [[-10.78, 'p1'], [10.78, 'p2']]) {
      box(w, { x: sx, y: 1.35, z: -1, w: 0.14, h: 0.8, d: 0.55, kind: 'rust', color: 0x22292b });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.28), readerMat); scr.position.set(sx - Math.sign(sx) * 0.075, 1.5, -1); scr.rotation.y = sx < 0 ? PI / 2 : -PI / 2; w.add(scr);
      stencil(w, 'WRISTBAND', { x: sx - Math.sign(sx) * 0.08, y: 1.05, z: -1, rot: sx < 0 ? PI / 2 : -PI / 2, width: 0.9, size: 0.2 });
      press({
        x: sx - Math.sign(sx) * 0.55, y: 1.3, z: -1, bw: 0.6, bh: 1.2, bd: 1.2, label: () => (c.get('scan:' + who, false) ? 'Wristband accepted' : 'Hold your wristband to the reader'), enabled: () => me === who && !c.get('scan:' + who, false),
        onUse: () => { c.set('scan:' + who, true); confirm(); S.intercom(); },
      });
    }
    let D0; // defined with the doors below
    c.on('scan:p1', () => scanCheck()); c.on('scan:p2', () => scanCheck());
    const scanCheck = () => {
      if (c.get('scan:' + me, false) && !w._scanned) { w._scanned = true; whisper('lt.c7.scan.k', 'lt.c7.scan.s'); }
      if (c.get('scan:p1', false) && c.get('scan:p2', false) && host && D0.locked) { D0.unlock(); D0.setOpen(true); sayAll('lt.c7.open', { priority: 2 }); }
      else if (c.get('scan:' + me, false) && !c.get('scan:' + other, false) && !w._scanWait) { w._scanWait = true; w.after(5, () => tell(me, 'lt.c7.scan.wait')); }
    };
    sayAll('lt.c7.intro', { priority: 2 });

    // ================================================================ 2. the Gallery of Directors =================================
    room(w, { x: 0, z: -21, w: 14, d: 28, h: HT, sides: { s: false }, doors: { w: [{ c: 5, w: 2.2 }], e: [{ c: 5, w: 2.2 }], n: [{ c: 0, w: 2.6 }] }, floorKind: 'wood', wallKind: 'plaster' });
    for (const sd of [-1, 1]) { wainscot(w, { x: sd * 7, z: -26.05, len: 17.9, along: 'z', side: -sd }); wainscot(w, { x: sd * 7, z: -10.95, len: 7.9, along: 'z', side: -sd }); }
    wainscot(w, { x: -3.8, z: -35, len: 6.4, along: 'x', side: 1 }); wainscot(w, { x: 3.8, z: -35, len: 6.4, along: 'x', side: 1 });
    rug(w, { x: 0, z: -21, w: 3.2, d: 26, color: 0x3d1a1e });
    stencil(w, 'GALLERY OF DIRECTORS', { x: 0, y: 3.55, z: -34.82, rot: 0, width: 5.4, size: 0.34 });
    const NAMES = ['E. HALLOWAY\n1931 - 1948', 'M. CASSIDY\n1948 - 1962', 'T. BRANE\n1962 - 1977', 'R. OKONKWO\n1977 - 1991', 'I. VOSS\n1991 - present', 'A. LINDQVIST\nDIRECTOR OF NURSING', 'THE TIDE COMMITTEE\nMINUTES BY ORDER'];
    const GZ = [-9.6, -12.6, -19.4, -22.4, -25.4, -28.4, -31.6];
    GZ.forEach((z, i) => {
      portrait(w, { x: -6.8, y: 2.25, z, nx: 1, nz: 0, seed: 20 + i, plaque: NAMES[i % NAMES.length] });
      if (i === GZ.length - 1) portrait(w, { x: 6.8, y: 2.25, z, nx: -1, nz: 0, seed: 40 + i, empty: true, plaque: 'ACTING DIRECTOR\n(to be hung)' });
      else portrait(w, { x: 6.8, y: 2.25, z, nx: -1, nz: 0, seed: 40 + i, plaque: NAMES[(i + 3) % NAMES.length] });
    });
    lamps([[0, -10, 'steady', 0.65, 1.4, PI / 2], [0, -15, 'buzz', 1, 1.4, PI / 2], [0, -20.5, 'dying', 1, 1.4, PI / 2], [0, -25.5, 'buzz', 0.9, 1.4, PI / 2], [0, -30, 'dead', 1, 1.4, PI / 2], [0, -33.2, 'dying', 0.8, 1.2, PI / 2]]);
    curtain(w, { x: -6.2, z: -9.2, width: 2.6, rot: PI / 2 }); curtain(w, { x: 6.2, z: -9.2, width: 2.6, rot: -PI / 2 });
    locker(w, { x: -6.5, z: -32.9, rot: PI / 2 }); locker(w, { x: -6.5, z: -33.55, rot: PI / 2, ajar: 0.5 }); locker(w, { x: 6.5, z: -32.9, rot: -PI / 2 }); locker(w, { x: 6.5, z: -33.55, rot: -PI / 2 });
    gurney(w, { x: 5.4, z: -24, rot: PI / 2 }); wheelchair(w, { x: -5.4, z: -26.5, rot: 0.8 });
    chair(w, { x: -5.9, z: -16, rot: PI / 2 });
    decal(w, { kind: 'drag', seed: 12, x: 0, y: 0.03, z: -26, w: 2.6, h: 6, face: 'floor', rot: 0 }); decal(w, { kind: 'puddle', seed: 6, x: -3, y: 0.025, z: -17, w: 2.6, h: 2.6 });
    decal(w, { kind: 'hand', seed: 9, x: -6.84, y: 1.0, z: -21, w: 0.5, h: 0.5, face: 'w' }); decal(w, { kind: 'scratch', seed: 3, x: 6.84, y: 1.4, z: -17.8, w: 1.4, h: 1.4, face: 'e' });
    checkpoint(w, { x: -4.4, z: -11 });
    pipes(w, { x0: -6.4, z0: -9, x1: -6.4, z1: -34, y: 3.9, n: 2 });

    // ================================================================ 3. the Study ==============================================
    room(w, { x: -13, z: -16, w: 12, d: 10, h: HT, sides: { e: false }, floorKind: 'wood' });
    wainscot(w, { x: -13, z: -21, len: 12, along: 'x', side: 1 }); wainscot(w, { x: -13, z: -11, len: 12, along: 'x', side: -1 }); wainscot(w, { x: -19, z: -16, len: 10, along: 'z', side: 1 });
    rug(w, { x: -13, z: -16, w: 7, d: 6, color: 0x2e3a2c });
    desk(w, { x: -12.5, z: -17.6, rot: 0, papers: false }); chair(w, { x: -12.5, z: -18.6, rot: 0 });
    desk(w, { x: -16.5, z: -12.9, rot: 0, papers: false }); chair(w, { x: -16.5, z: -11.9, rot: PI });
    pedestal(w, { x: -17.8, z: -19.4, h: 1.0, s: 0.5 });
    shelf(w, { x: -9.3, z: -20.45, len: 3.8, along: 'x', seed: 2 }); shelf(w, { x: -16.9, z: -20.45, len: 3.8, along: 'x', seed: 5 }); shelf(w, { x: -10.6, z: -11.55, len: 3.8, along: 'x', seed: 4 });
    portrait(w, { x: -12.5, y: 2.6, z: -20.8, seed: 77, width: 1.3, height: 1.7, plaque: 'DR. IMRE VOSS\nDIRECTOR' });
    barWindow(w, { x: -18.82, y: 2.1, z: -16, rot: PI / 2, width: 1.6, height: 1.5 });
    wallClock(w, { x: -8.4, y: 3.2, z: -20.8, hh: 3, mm: 7 });
    lamps([[-13, -16, 'dying', 0.9, 1.2, PI / 2], [-17, -13.5, 'buzz', 0.8, 1.0, 0], [-9.5, -18.5, 'steady', 0.5, 0.8]]);
    glowSpot(w, { x: -12.5, y: 1.2, z: -17.6, size: 2.2, opacity: 0.18 });
    decal(w, { kind: 'puddle', seed: 8, x: -14.5, y: 0.025, z: -14, w: 2.2, h: 2.2 }); decal(w, { kind: 'splat', seed: 14, x: -10, y: 0.02, z: -15.5, w: 1.4, h: 1.4 });
    decal(w, { kind: 'hand', seed: 4, x: -7.16, y: 1.3, z: -19, w: 0.5, h: 0.5, face: 'e' });
    stencil(w, 'THE DIRECTOR\'S STUDY', { x: -13, y: 3.45, z: -10.82, rot: PI, width: 4, size: 0.3 });
    // the three papers (two versions of every one)
    let rv1n = 0;
    const study = (title, k, s, x, y, z, ix, iz) => paper({
      x, y, z, title, size: 0.34, ix, iz,
      html: { get keyholder() { return k(names()); }, get subject() { return s(names()); } },
      onRead: () => { rv1n++; if (rv1n === 3 && !w._rv1) { w._rv1 = true; c.set('rv1:' + me, true); w.after(1.5, () => whisper('lt.c7.rv1.k', 'lt.c7.rv1.s')); } else if (rv1n < 3) tell(me, 'lt.c7.rv1.more'); },
    });
    study('STAFF FILE · ATTENDING // ADMISSION CARD',
      (n) => `<b>LOWTIDE MEMORIAL · STAFF FILE</b><br><i>Attending physician, Ward B (nights)</i><p><b>Name:</b> ${n.M}<br><b>Patient assigned:</b> ${n.O}<br><b>Since:</b> 14 March, the night before the tide table was changed.</p><p>Duties: administer the forgetting protocol. Keep the patient calm. Keep the key. Never tell the patient their name. Never tell them yours.</p><p style="opacity:.75"><i>Pinned to the file:</i> the attending is to take the same dose, "to share the burden". The attending has declined three times. Initialled: ${n.M}. <i>(The fourth set of initials is in a different hand.)</i></p>`,
      (n) => `<b>VOLUNTARY ADMISSION</b><br><i>Lowtide Memorial · Ward B</i><p><b>Patient:</b> ${n.M}<br><b>Escort:</b> ${n.O}, attending<br><b>Date:</b> 14 March</p><p>Reason for admission: <i>"I asked them to take it out of my head."</i><br>Signed by the patient, in the patient's own hand, with the pen on the string.</p><p style="opacity:.75">Witness: ${n.O}. <i>(The witness has underlined their own name twice.)</i></p>`,
      -12.5, 0.82, -17.6, -12.5, -15.9);
    study('TREATMENT LOG // DRUG CHART',
      (n) => `<b>TREATMENT LOG</b> · <i>Ward B, night shift</i><p>03/14 Patient asks for the tide. Told: there is no tide.<br>03/15 Patient asks for their name. Told: ${n.O}. It is not their name.<br>03/16 Dose given. <b>Dose: see patient's chart</b> <i>(kept in the patient's own file, by order of the Director)</i>.<br>03/17 I took the dose too. I wanted to know what it is like not to know.</p><p>03/19 I cannot tell which of us is sleeping. The key hangs on a string round my neck. I do not remember choosing to wear it.</p>`,
      (n) => `<b>DRUG CHART · ${n.M}</b><p>Agent: the forgetting protocol.<br><b>Dose: 6 mg</b>, every three hours until the tide.<br>Given by: ${n.O}.<br>Patient request, in the margin: <i>"Do not let me ask for it back."</i></p><p>03/16 asked for it back. Not given.<br>03/17 asked for it back. Not given.<br>03/19 asked who ${n.O} was. Told: a nurse.</p>`,
      -16.5, 0.82, -12.9, -16.5, -14.6);
    study('MEMO // NOTES TO SELF',
      () => `<b>FROM THE DIRECTOR'S OFFICE</b> <i>(typed, unsigned)</i><p>The tide will take the ward at the equinox, as it has before. The Director's wing is the last dry floor. It was built for two.</p><p>The attending will be offered a way to leave without the patient. It is not a trap and it is not a test. It is a door that locks from one side, and it was always going to be you on that side.</p><p>Whatever you decide, the patient will have asked for it.</p><p style="opacity:.7"><i>(Someone has underlined "asked for it" so hard the pen went through.)</i></p>`,
      () => `<b>(in your handwriting, on the back of a menu card)</b><p>1. The one beside you is the attending. They treated you. You asked them to. Do not be angry yet.</p><p>2. They are carrying the key. They do not know they are carrying it. You will know by how they hold their hand.</p><p>3. If a door will not open, the lock is a relay behind a steel panel. I made a rhyme so I would not forget it, and then I forgot the rhyme. <b>It is on the tape.</b></p>`,
      -17.8, 1.08, -19.4, -16.3, -19.4);
    c.on('rv1:p1', () => rv1Check()); c.on('rv1:p2', () => rv1Check());
    const rv1Check = () => {
      if (c.get('rv1:p1', false) && c.get('rv1:p2', false)) { hostDo(() => { if (D_mr.locked) { D_mr.unlock(); sayAll('lt.c7.rv1.open', { priority: 2 }); } }); }
      else if (c.get('rv1:' + me, false) && !w._rvw) { w._rvw = true; w.after(4, () => tell(me, 'lt.c7.rv1.wait')); }
    };

    // ================================================================ 4. the Mirror Room =========================================
    room(w, { x: 13, z: -16, w: 12, d: 10, h: HT, sides: { w: false, e: false }, floorKind: 'wood' });
    wainscot(w, { x: 13, z: -21, len: 12, along: 'x', side: 1 }); wainscot(w, { x: 13, z: -11, len: 12, along: 'x', side: -1 });
    wall(w, { x: 19, z: -20.15, w: 0.3, d: 1.7 }); wall(w, { x: 19, z: -11.85, w: 0.3, d: 1.7 }); wall(w, { x: 19, z: -16, w: 0.3, d: 6.6, y: 3.3, h: HT - 3.3 });
    hp(w, { x: 24.6, y: 0, z: -16, w: 11.4, d: 6.8, h: 1, kind: 'concrete', path: false });
    wall(w, { x: 30.15, z: -16, w: 0.3, d: 7.1 }); wall(w, { x: 24.6, z: -19.55, w: 11.4, d: 0.3 }); wall(w, { x: 24.6, z: -12.45, w: 11.4, d: 0.3 });
    box(w, { x: 24.6, y: HT + 0.25, z: -16, w: 12, h: 0.5, d: 7.4, kind: 'concrete', shadow: false });
    w.collider({ x: 18.9, y: 1.7, z: -16, w: 0.3, h: 3.4, d: 6.4 });
    const MIR = { x: 18.85, z: -16 };
    const glass = mirrorGlass(w, { x: MIR.x, y: 1.6, z: MIR.z, nx: -1, nz: 0, width: 6.2, height: 2.7 });
    const mirLamp = H.lamp({ x: 25, y: LY, z: -16, mode: 'dying', power: 0.7, color: 0xaecbd8, len: 1.4 });
    lamps([[11, -16, 'buzz', 0.9, 1.3, PI / 2], [15, -13, 'dying', 0.8, 1.0], [8.8, -19.2, 'steady', 0.5, 0.8]]);
    rug(w, { x: 13, z: -16, w: 6.6, d: 5.4, color: 0x2c2f3a });
    for (const x of [9.1, 9.8, 10.5]) locker(w, { x: x, z: -20.55, rot: 0, ajar: x === 9.8 ? 0.35 : 0 });
    box(w, { x: 13.4, y: 1.55, z: -20.62, w: 0.55, h: 1.3, d: 0.07, kind: 'padded', color: 0xdad7c8, rough: 1 }); box(w, { x: 15.4, y: 1.45, z: -20.62, w: 0.5, h: 1.2, d: 0.07, kind: 'padded', color: 0x7b8a86, rough: 1 });
    stencil(w, 'STAFF', { x: 13.4, y: 2.55, z: -20.8, rot: 0, width: 1.2, size: 0.3 }); stencil(w, 'PATIENT', { x: 15.4, y: 2.45, z: -20.8, rot: 0, width: 1.5, size: 0.3 });
    desk(w, { x: 10.5, z: -12.2, rot: 0, papers: false }); chair(w, { x: 10.5, z: -13.2, rot: 0 }); bench(w, { x: 15.5, z: -11.7, rot: 0 });
    barWindow(w, { x: 7.18, y: 2.1, z: -19, rot: -PI / 2, width: 1.0, height: 1.2 });
    stencil(w, 'DO NOT STAND TOO CLOSE', { x: 13, y: 3.45, z: -10.82, rot: PI, width: 5, size: 0.3 });
    decal(w, { kind: 'puddle', seed: 12, x: 14, y: 0.025, z: -17, w: 2.4, h: 2.4 }); decal(w, { kind: 'drag', seed: 7, x: 12, y: 0.03, z: -14, w: 2.4, h: 2.4, face: 'floor', rot: 1 }); decal(w, { kind: 'hand', seed: 16, x: 7.16, y: 1.2, z: -13, w: 0.5, h: 0.5, face: 'w' });

    // ================================================================ 5. the Screening Room ======================================
    room(w, { x: 0, z: -43, w: 14, d: 16, h: HT, sides: { s: false, n: false }, floorKind: 'wood', wallKind: 'plaster' });
    wainscot(w, { x: -7, z: -43, len: 16, along: 'z', side: 1 }); wainscot(w, { x: 7, z: -43, len: 16, along: 'z', side: -1 });
    for (const z of [-41, -44.2, -47.4]) for (const x of [-3.2, 3.2]) bench(w, { x, z, rot: 0, len: 2.6 });
    const PR = projector(w, { x: 0, z: -38.6 });
    lamps([[-4, -40, 'dead'], [4, -45, 'dying', 0.7], [0, -37, 'buzz', 0.7, 1.0]]);
    curtain(w, { x: -6.3, z: -41, width: 2.6, rot: PI / 2 }); curtain(w, { x: 6.3, z: -47, width: 2.6, rot: -PI / 2 });
    locker(w, { x: -6.5, z: -49.5, rot: PI / 2 }); locker(w, { x: 6.5, z: -49.5, rot: -PI / 2 });
    stencil(w, 'SCREENING ROOM', { x: 4.2, y: 3.4, z: -35.2, rot: 0, width: 3.2, size: 0.3 }); stencil(w, 'SILENCE DURING THE FILM', { x: -4.2, y: 3.4, z: -35.2, rot: 0, width: 3.6, size: 0.26 });
    decal(w, { kind: 'drag', seed: 31, x: 0, y: 0.03, z: -45, w: 2.2, h: 5, face: 'floor', rot: 0 }); decal(w, { kind: 'splat', seed: 17, x: -3, y: 0.02, z: -49.5, w: 1.8, h: 1.8 }); decal(w, { kind: 'hand', seed: 21, x: 6.84, y: 1.3, z: -40, w: 0.5, h: 0.5, face: 'w' });
    let reelT = -1, reelDone = false;                                // seconds since the film began on THIS machine (-1: not started)
    const screen = monitor(w, { x: -1.5, y: 2.2, z: -50.7, nx: 0, nz: 1, width: 7, height: 3.2, cw: 640, ch: 292, draw: (g, cw, ch, t) => drawFilm(g, cw, ch, t, reelT) });
    const scBoth = c.zone({ x: 0, y: 1, z: -43, w: 13, h: 3, d: 15, need: 'both', shrink: 0 });
    press({
      x: 0, y: 1.2, z: -37.4, bw: 1.2, bh: 1.6, bd: 0.9, label: () => (reelT >= 0 || reelDone ? 'The reel is running' : 'Start the reel'), enabled: () => reelT < 0 && !reelDone,
      onUse: () => { if (!scBoth.active) { tell(me, 'lt.c7.reel.wait'); return; } c.emit('c7:reel'); },
    });

    // ================================================================ 6. the Strongroom Lobby =====================================
    room(w, { x: 0, z: -59, w: 20, d: 16, h: HT, sides: { s: true }, doors: { w: [{ c: 0, w: 2.4 }], e: [{ c: 0, w: 2.2 }], n: [{ c: -8, w: 2.0 }], s: [{ c: 5.5, w: 2.2 }] }, floorKind: 'tile', wallKind: 'plaster' });
    wainscot(w, { x: 0, z: -67, len: 20, along: 'x', side: 1 }); wainscot(w, { x: -3.2, z: -51, len: 13.6, along: 'x', side: -1 });
    rug(w, { x: 0, z: -59, w: 6, d: 10, color: 0x3d1a1e });
    for (const [x, z] of [[-5, -55.5], [5, -55.5], [-5, -62.5], [5, -62.5]]) column(w, { x, z, h: HT });
    chandelier(w, { x: 0, y: 3.1, z: -59, r: 1.1 });
    stencil(w, 'STRONGROOM LOBBY', { x: 4, y: 3.6, z: -66.82, rot: 0, width: 4.4, size: 0.32 });
    stencil(w, 'ARCHIVE VAULT', { x: -9.82, y: 3.5, z: -61.8, rot: PI / 2, width: 2.6, size: 0.3 });
    stencil(w, 'BOARDROOM →', { x: 9.82, y: 3.5, z: -55.5, rot: -PI / 2, width: 2.6, size: 0.28 }); stencil(w, '↑ PRIVATE ROOMS', { x: -3, y: 3.5, z: -66.82, rot: 0, width: 3.2, size: 0.26 });
    bench(w, { x: 0, z: -52.4, rot: 0, len: 2.4 }); wheelchair(w, { x: 7.6, z: -64.5, rot: 2.3 }); wheelchair(w, { x: -3.4, z: -64.8, rot: -0.4 });
    lamps([[-3, -55, 'buzz', 0.8, 1.2], [3.5, -62, 'dying', 0.9, 1.2], [0, -59, 'steady', 0.5, 0.9, PI / 2], [-7, -63, 'dead']]);
    decal(w, { kind: 'puddle', seed: 15, x: 3, y: 0.025, z: -61, w: 3, h: 3 }); decal(w, { kind: 'drag', seed: 22, x: -3, y: 0.02, z: -57, w: 3.4, h: 2.6, face: 'floor', rot: 1.57 });
    decal(w, { kind: 'hand', seed: 14, x: 9.84, y: 1.2, z: -63, w: 0.5, h: 0.5, face: 'w' }); decal(w, { kind: 'scratch', seed: 27, x: 5, y: 1.6, z: -66.84, w: 1.4, h: 1.4, face: 'n' });
    checkpoint(w, { x: 3.4, z: -54 }); checkpoint(w, { x: -4, z: -63.4 });
    // the bolt: a console beside the vault door with one large lever
    const bolt = leverConsole(w, { x: -9.15, z: -55.6, nx: 1, nz: 0, n: 1, labels: ['BOLT'] });
    stencil(w, 'VAULT BOLT', { x: -9.82, y: 2.6, z: -55.6, rot: PI / 2, width: 1.8, size: 0.26 });

    // ================================================================ 7. the vault ===============================================
    room(w, { x: -17, z: -60, w: 14, d: 14, h: HT, sides: { e: false }, floorKind: 'concrete', wallKind: 'concrete' });
    const vaultLamps = lamps([[-21, -57, 'dying', 0.9, 1.1], [-14, -63, 'buzz', 0.8, 1.1], [-17.5, -60, 'dead'], [-12, -55, 'dying', 0.7, 1.0]]);
    const boxes = depositBoxes(w, { x0: -22.8, z: -66.85, n: 8, spacing: 1.2, y: 1.45, rows: 1 });
    stencil(w, 'DEPOSIT · PATIENT EFFECTS', { x: -18, y: 3.1, z: -66.82, rot: 0, width: 5, size: 0.3 });
    locker(w, { x: -23.55, z: -64.4, rot: PI / 2 }); locker(w, { x: -23.55, z: -65.2, rot: PI / 2, ajar: 0.4 });
    desk(w, { x: -15.2, z: -64.2, rot: PI / 2, papers: false });
    desk(w, { x: -21.7, z: -60, rot: PI / 2, papers: false });
    bench(w, { x: -12.2, z: -64.6, rot: PI / 2 });
    decal(w, { kind: 'puddle', seed: 33, x: -17, y: 0.025, z: -58, w: 3.2, h: 3.2 }); decal(w, { kind: 'drag', seed: 35, x: -14, y: 0.02, z: -60, w: 3.4, h: 2.4, face: 'floor', rot: 1.57 });
    decal(w, { kind: 'scratch', seed: 36, x: -23.84, y: 1.6, z: -56, w: 1.6, h: 1.6, face: 'w' }); decal(w, { kind: 'hand', seed: 38, x: -23.84, y: 1.2, z: -63, w: 0.5, h: 0.5, face: 'w' });
    decal(w, { kind: 'scratch', seed: 40, x: -13, y: 1.4, z: -66.84, w: 1.4, h: 1.4, face: 'n' });
    pipes(w, { x0: -23.4, z0: -66, x1: -23.4, z1: -54, y: 3.8, n: 2 });
    const panel = maintPanel(w, { x: -12.5, y: 1.55, z: -53.1, nx: 0, nz: -1 });
    const overload = leverConsole(w, { x: -19.5, z: -53.5, nx: 0, nz: -1, n: 1, labels: ['OVERLOAD'] });
    stencil(w, 'PRESSURE · MAINS', { x: -19.5, y: 2.6, z: -53.18, rot: PI, width: 2.4, size: 0.26 });
    const placardPos = { x: -16.2, y: 1.8, z: -53.2 };
    // ledger and wiring placard (public, in the vault)
    paper({
      x: -15.2, y: 0.82, z: -64.2, title: 'VAULT LEDGER', size: 0.34, ix: -16.6, iz: -64.2,
      html: '<b>ARCHIVE VAULT · EFFECTS LEDGER</b><p>Box 1 &nbsp;wristbands (cut)<br>Box 2 &nbsp;a child\'s shoe<br>Box 3 &nbsp;syringes, spent<br>Box 4 &nbsp;cassette, unlabelled. <i>Do not play.</i><br>Box 5 &nbsp;<b>maintenance: brass opener, spare plugs</b><br>Box 6 &nbsp;photograph, face down<br>Box 7 &nbsp;spectacles; a note: "I am sorry"<br>Box 8 &nbsp;tally cards</p><p style="opacity:.75"><i>Handwritten under the last line:</i> the relay for the bolt is behind the steel plate by the south wall. Four screws. The plugs are labelled. If you ever need to leave this room against someone\'s wishes, that is the way. I wrote that for myself.</p>',
    });
    paper({
      x: placardPos.x, y: placardPos.y, z: placardPos.z, face: { nx: 0, nz: -1 }, size: 0.5, ix: placardPos.x, iz: -54.3, title: 'RELAY WIRING',
      html: '<b>BOLT RELAY · WIRING</b><br><i>Maintenance, do not remove.</i><p>Three plugs, three sockets, left to right:<br><b>BELL</b> &nbsp; plug the <b>BLUE</b> lead<br><b>EARTH</b> &nbsp; <span style="opacity:.5">▇▇▇▇▇ (burnt)</span><br><b>BED</b> &nbsp; plug the <b>RED</b> lead</p><p>Wrong order and the relay trips and the bolt stays. Right order arms the overload: pull the lever and the coil will burn out and the bolt will let go.</p><p style="opacity:.75"><i>(In pencil, in the corner:)</i> the earth lead is the one with the stripe. Yellow and green. Pick the one that is <i>not</i> in the tune.</p>',
    });
    // the deposit boxes: only box 5 matters; the others are the room remembering
    const boxOpen = [];
    boxes.forEach((B) => {
      c.on('vb:' + B.n, (v) => { if (v && !boxOpen[B.n]) { boxOpen[B.n] = true; B.swing(1); S.door(0, 0.18); S.squeak(0, 0.08); } });
      press({
        x: B.x, y: 1.4, z: B.z + 0.1, bw: 1.1, bh: 1.4, bd: 0.8, label: () => (boxOpen[B.n] ? `Box ${B.n}` : `Open box ${B.n}`), enabled: () => !boxOpen[B.n],
        onUse: () => { c.set('vb:' + B.n, true); confirm(); tell(me, `lt.c7.box.${B.n}`, { priority: 2 }); if (B.n === 5) c.set('v:tool', true); if (B.n === 4) { Z.whisper({}); H.stutter(1.5); } if (B.n === 8) { Z.knock({ n: 2 }); } },
      });
    });
    const toolHere = () => c.get('v:tool', false);
    // the cover and the plugs
    const scr = [false, false, false, false];
    const wires = [0, 0, 0];
    const covered = () => scr.some((v) => !v);
    const armed = () => !covered() && wires.every((v, i) => v === SOLUTION[i]);
    let breach = false, armedSaid = false;
    const unscrewAt = panel.at(0, 0);
    press({
      x: unscrewAt.x, y: 1.55, z: unscrewAt.z, bw: 1.6, bh: 1.6, bd: 0.8, label: () => (toolHere() ? `Unscrew the cover (${scr.filter(Boolean).length}/4)` : 'A steel cover. Four screws.'), enabled: () => covered(),
      onUse: () => {
        if (!toolHere()) { tell(me, 'lt.c7.panel.notool', { priority: 1 }); S.squeak(0, 0.06); return; }
        const i = scr.findIndex((v) => !v); if (i < 0) return; c.set('v:s' + i, true); confirm();
      },
    });
    for (let i = 0; i < 4; i++) c.on('v:s' + i, (v) => {
      if (!v || scr[i]) return; scr[i] = true; panel.setScrew(i, true); S.scrape(0, 0.1); S.squeak(0.3, 0.07);
      if (i === 1) { tell(me, 'lt.c7.panel.half', { priority: 1 }); Z.blackout(2.2); w.after(2.6, () => Z.behind('patient', { role: me, dist: 3.4, dur: 9 })); }
      if (scr.every(Boolean)) { panel.setCover(true); S.door(0, 0.3); if (R.is('subject') || true) tell('all', 'lt.c7.panel.open', { priority: 1 }); }
    });
    for (let i = 0; i < 3; i++) {
      const pt = panel.at([-0.4, 0, 0.4][i], 0.1);
      c.on('v:w' + i, (v) => { wires[i] = (v | 0) % 4; panel.setWire(i, wires[i]); S.squeak(0.2, 0.05); panel.setArmed(armed()); if (armed() && !armedSaid) { armedSaid = true; S.bell(0, 0.15); tell('all', 'lt.c7.panel.armed', { priority: 2 }); overload.set(0, false); } });
      press({ x: pt.x, y: 1.6, z: pt.z, bw: 0.38, bh: 1.4, bd: 0.8, label: () => `${['BELL', 'EARTH', 'BED'][i]} socket · ${WIRE[wires[i]].n} (next)`, enabled: () => !covered() && !breach, onUse: () => { c.set('v:w' + i, (wires[i] + 1) % 4); confirm(); } });
    }
    const ov = overload.levers[0];
    press({ x: ov.x, y: 1.2, z: ov.z, bw: 0.7, bh: 1.4, bd: 0.6, label: () => (armed() ? 'Throw the overload' : 'OVERLOAD (no power)'), enabled: () => !breach, onUse: () => { if (!armed()) { S.squeak(0, 0.06); tell(me, 'lt.c7.panel.dead', { priority: 1 }); return; } c.emit('c7:breach'); } });
    w.updaters.push((dt) => { overload.tick(dt); bolt.tick(dt); });

    // the camera console: power, a live map, a bell
    const BELLS = [{ id: 'bd', x: 16, z: -57, t: 'Ring the Boardroom bell' }, { id: 'ch', x: 3, z: -77, t: 'Ring the Chapel bell' }];
    let powered = false, bellCool = 0;
    for (const [z, col] of [[-60.9, 0x3dff9a], [-60, 0xffc47a], [-59.1, 0xffc47a]]) box(w, { x: -21.45, y: 0.8, z, w: 0.22, h: 0.08, d: 0.22, kind: 'rust', color: 0x111111 }), glowSpot(w, { x: -21.45, y: 0.9, z, color: col, size: 0.5, opacity: 0.7 });
    press({
      x: -20.7, y: 1.1, z: -60.9, bw: 0.7, bh: 1.2, bd: 0.8, label: () => (R.is('subject') ? 'Switch on the cameras (patient wristband)' : 'Camera console: patient wristband required'), enabled: () => !powered,
      onUse: () => { if (!R.is('subject')) { tell(me, 'lt.c7.power.no', { priority: 1 }); S.squeak(0, 0.06); return; } c.emit('c7:power'); },
    });
    BELLS.forEach((B, i) => press({
      x: -20.7, y: 1.1, z: -60 + i * 0.9, bw: 0.7, bh: 1.2, bd: 0.8, label: () => (!powered ? 'Bell (no power)' : bellCool > 0 ? 'The bell is still ringing' : B.t), enabled: () => powered,
      onUse: () => { if (bellCool > 0) return; c.emit('c7:bell', { i }); },
    }));
    c.onEvent('c7:bell', (a) => { const B = BELLS[a?.i | 0]; if (!B) return; S.bell(0.5, 0.12); bellCool = 22; if (host) st.noise(B.x, B.z, 18); });
    w.updaters.push((dt) => { bellCool = Math.max(0, bellCool - dt); });
    let monT = 0;
    const cctv = monitor(w, { x: -23.7, y: 2.0, z: -60, nx: 1, nz: 0, width: 3.6, height: 2.5, cw: 544, ch: 384, draw: (g, cw, ch, t) => drawMap(g, cw, ch, t) });
    w.updaters.push((dt) => { monT -= dt; if (monT <= 0) { monT = 0.15; cctv.redraw(w.t); screen.redraw(w.t); } });

    // ================================================================ 8. the private wing =========================================
    // Boardroom (east)
    room(w, { x: 18, z: -59, w: 16, d: 16, h: HT, sides: { w: false }, doors: { n: [{ c: 4, w: 2.0 }] }, floorKind: 'wood', wallKind: 'plaster' });
    wainscot(w, { x: 18, z: -51, len: 16, along: 'x', side: -1 }); wainscot(w, { x: 26, z: -59, len: 16, along: 'z', side: -1 });
    rug(w, { x: 18, z: -59, w: 9.4, d: 4.6, color: 0x24303a });
    longTable(w, { x: 18, z: -59, len: 8, wd: 2.6 });
    for (const sx of [-3, -1, 1, 3]) for (const sz of [-1, 1]) chair(w, { x: 18 + sx, z: -59 + sz * 1.9, rot: sz > 0 ? PI : 0 });
    chair(w, { x: 22.9, z: -59, rot: -PI / 2 });
    for (const z of [-55.5, -62.5]) barWindow(w, { x: 25.82, y: 2.3, z, rot: -PI / 2, width: 1.8, height: 2.0 });
    wallClock(w, { x: 21, y: 3.3, z: -66.82, nx: 0, nz: 1, hh: 3, mm: 7, r: 0.4 });
    portrait(w, { x: 14, y: 2.5, z: -66.82, seed: 61, width: 1.2, height: 1.6, plaque: 'THE TIDE COMMITTEE\n1931 - ' });
    curtain(w, { x: 25.3, z: -53.8, width: 2.6, rot: -PI / 2 }); curtain(w, { x: 25.3, z: -64.8, width: 2.6, rot: -PI / 2 });
    lamps([[14, -55, 'dying', 0.9, 1.2], [22, -57, 'buzz', 0.8, 1.2], [18, -62.5, 'dead'], [13, -63, 'dying', 0.6, 1.0]]);
    glowSpot(w, { x: 18, y: 1.0, z: -59, size: 3, opacity: 0.12 });
    decal(w, { kind: 'puddle', seed: 41, x: 14, y: 0.025, z: -64, w: 3, h: 3 }); decal(w, { kind: 'splat', seed: 42, x: 23, y: 0.02, z: -55, w: 1.8, h: 1.8 }); decal(w, { kind: 'hand', seed: 43, x: 25.84, y: 1.2, z: -58, w: 0.5, h: 0.5, face: 'e' });
    stencil(w, 'BOARDROOM', { x: 14, y: 3.45, z: -51.18, rot: PI, width: 3, size: 0.3 });
    paper({
      x: 22.2, y: 0.83, z: -59, title: 'MINUTES OF THE TIDE COMMITTEE', size: 0.34, ix: 22.2, iz: -56.4,
      html: '<b>MINUTES · TIDE COMMITTEE</b><br><i>Quorum: the Director, the Attending, the Patient (by proxy)</i><p>Item 1. That the ward shall not be moved.<br>Item 2. That the patient shall not be told.<br>Item 3. That one of the staff shall be offered the key and one of the patients the door, and that neither shall know which.</p><p><b>Motion carried, five votes to none.</b><br>(There were only three of us in the room. Nobody has asked who the other two were.)</p>',
    });
    // Library (north of the boardroom)
    room(w, { x: 18, z: -74, w: 16, d: 14, h: HT, sides: { s: false }, doors: { w: [{ c: 0, w: 2.0 }] }, floorKind: 'wood', wallKind: 'plaster' });
    wainscot(w, { x: 18, z: -81, len: 16, along: 'x', side: 1 }); wainscot(w, { x: 26, z: -74, len: 14, along: 'z', side: -1 });
    shelf(w, { x: 15.0, z: -71.5, len: 3.8, along: 'x', seed: 11 }); shelf(w, { x: 18.8, z: -71.5, len: 3.8, along: 'x', seed: 12 });
    shelf(w, { x: 15.0, z: -78.4, len: 3.8, along: 'x', seed: 13 }); shelf(w, { x: 18.8, z: -78.4, len: 3.8, along: 'x', seed: 14 }); shelf(w, { x: 22.6, z: -80.45, len: 3.8, along: 'x', seed: 15 });
    desk(w, { x: 23.8, z: -76.4, rot: 0, papers: false }); chair(w, { x: 23.8, z: -77.4, rot: 0 });
    lamps([[14, -73.5, 'dying', 0.8, 1.2], [22, -71, 'buzz', 0.8, 1.2], [23.5, -77, 'dying', 0.7, 0.8], [17, -76, 'dead']]);
    glowSpot(w, { x: 23.8, y: 1.3, z: -76.4, size: 2.4, opacity: 0.2 });
    decal(w, { kind: 'puddle', seed: 51, x: 21, y: 0.025, z: -73, w: 2.6, h: 2.6 }); decal(w, { kind: 'drag', seed: 52, x: 14, y: 0.02, z: -75, w: 3.4, h: 2.4, face: 'floor', rot: 1.57 }); decal(w, { kind: 'hand', seed: 53, x: 25.84, y: 1.3, z: -70, w: 0.5, h: 0.5, face: 'e' });
    stencil(w, 'LIBRARY · SILENCE', { x: 14, y: 3.5, z: -80.82, rot: 0, width: 3.6, size: 0.3 });
    curtain(w, { x: 25.3, z: -70, width: 2.6, rot: -PI / 2 });
    paper({
      x: 23.8, y: 0.83, z: -76.4, title: 'CARD INDEX', size: 0.34, ix: 23.8, iz: -74.8,
      html: '<b>CARD INDEX · THE DIRECTOR\'S BOOKS</b><p>Vol. 1 &nbsp;<i>A History of the Tide, 1931</i><br>Vol. 2 &nbsp;<b>The Forgetting Protocol, second and only edition</b><br>Vol. 3 &nbsp;<i>Staff Conduct (withdrawn)</i></p><p style="opacity:.8">Index entry in a different ink: <i>"Everything you need is in volume <b>two</b>. Everything I did to myself is in volume two."</i></p>',
    });
    // Chapel (west of the library)
    room(w, { x: 2, z: -74, w: 16, d: 14, h: HT, sides: { s: false, e: false }, doors: { w: [{ c: 0, w: 2.0 }], n: [{ c: 2, w: 2.4 }] }, floorKind: 'wood', wallKind: 'plaster' });
    wainscot(w, { x: -2.9, z: -81, len: 5.8, along: 'x', side: 1 }); wainscot(w, { x: 7.1, z: -81, len: 5.8, along: 'x', side: 1 });
    for (const z of [-69.8, -71.5, -76.6, -78.3]) { bench(w, { x: -2.4, z, rot: 0, len: 3.2 }); bench(w, { x: 6.2, z, rot: 0, len: 3.2 }); }
    box(w, { x: -2, y: 0.2, z: -80.2, w: 5, h: 0.4, d: 1.2, kind: 'wood', color: 0x3d2c1f }); box(w, { x: -2, y: 1.0, z: -80.2, w: 2.4, h: 0.8, d: 0.9, kind: 'wood', color: 0x4d3828 }); w.collider({ x: -2, y: 0.6, z: -80.2, w: 5, h: 1.2, d: 1.2 });
    for (const sx of [-3.2, -0.8]) { const cd = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0xd8d0b0, emissive: 0x6a4a18, emissiveIntensity: 0.5 })); cd.position.set(sx, 1.55, -80.2); w.add(cd); glowSpot(w, { x: sx, y: 1.75, z: -80.2, color: 0xffb35a, size: 0.8, opacity: 0.8 }); }
    barWindow(w, { x: -1.0, y: 2.6, z: -80.82, rot: 0, width: 1.4, height: 2.2, glow: 0x3a1a2a }); barWindow(w, { x: -3.6, y: 2.6, z: -80.82, rot: 0, width: 1.4, height: 2.2, glow: 0x1a2a3a });
    curtain(w, { x: -5.4, z: -77.5, width: 2.4, rot: PI / 2 }); curtain(w, { x: 9.3, z: -78.5, width: 2.4, rot: -PI / 2 });
    lamps([[2, -70, 'dying', 0.8, 1.2], [5.5, -77, 'buzz', 0.8, 1.2], [-3, -75, 'dead'], [-2, -78.5, 'dying', 0.6, 1.0]]);
    decal(w, { kind: 'puddle', seed: 61, x: 2, y: 0.025, z: -75, w: 3, h: 3 }); decal(w, { kind: 'drag', seed: 62, x: 2, y: 0.02, z: -72, w: 2.4, h: 4, face: 'floor', rot: 0 }); decal(w, { kind: 'scratch', seed: 63, x: -5.84, y: 1.5, z: -72, w: 1.4, h: 1.4, face: 'w' });
    stencil(w, 'CHAPEL OF REST', { x: -2, y: 3.6, z: -80.82, rot: 0, width: 3.6, size: 0.3 });
    // the hymn board (digit 3)
    box(w, { x: -6.1, y: 2.1, z: -73.0, w: 0.1, h: 1.2, d: 1.5, kind: 'wood', color: 0x1e1812 });
    const [hc, hq] = (() => { const cvv = document.createElement('canvas'); cvv.width = 256; cvv.height = 200; return [cvv, cvv.getContext('2d')]; })();
    hq.fillStyle = '#0b0b0a'; hq.fillRect(0, 0, 256, 200); hq.fillStyle = '#e1d9b6'; hq.font = '700 28px "Courier New", monospace'; hq.textAlign = 'center'; hq.fillText('HYMNS', 128, 40); hq.font = '800 90px "Courier New", monospace'; hq.fillText('9', 128, 140); hq.font = '700 16px "Courier New", monospace'; hq.fillText('"WHEN THE TIDE COMES IN"', 128, 180);
    const hth = new THREE.CanvasTexture(hc); hth.colorSpace = THREE.SRGBColorSpace;
    const hb = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.05), new THREE.MeshBasicMaterial({ map: hth, color: 0x9a968a })); hb.position.set(-6.04, 2.1, -73); hb.rotation.y = PI / 2; w.add(hb);
    paper({
      x: -4.9, y: 1.2, z: -73.0, face: { nx: 1, nz: 0 }, size: 0.3, ix: -4.6, iz: -73.0, title: 'ORDER OF SERVICE',
      html: '<b>CHAPEL OF REST · ORDER OF SERVICE</b><p>The hymn is on the board. It is always the same hymn. It is the last thing sung.</p><p>The congregation will stand. The congregation will not be told why. The congregation is you.</p><p style="opacity:.8"><i>(For the safe: the third number is the hymn.)</i></p>',
    });
    // the Safe Room (west)
    room(w, { x: -14, z: -74, w: 16, d: 14, h: HT, sides: { s: false, e: false }, floorKind: 'wood', wallKind: 'plaster' });
    wainscot(w, { x: -14, z: -81, len: 16, along: 'x', side: 1 }); wainscot(w, { x: -22, z: -74, len: 14, along: 'z', side: 1 });
    rug(w, { x: -14, z: -73, w: 7, d: 6, color: 0x2e1c1c });
    desk(w, { x: -18.5, z: -72, rot: PI / 2, papers: true }); chair(w, { x: -17.4, z: -72, rot: -PI / 2 });
    shelf(w, { x: -20.3, z: -78.2, len: 3.8, along: 'z', seed: 3 }); portrait(w, { x: -9.5, y: 2.5, z: -80.82, seed: 88, width: 1.3, height: 1.7, plaque: 'DR. IMRE VOSS\nHE KEEPS THE KEY' });
    curtain(w, { x: -6.7, z: -78.5, width: 2.4, rot: PI / 2 }); locker(w, { x: -21.5, z: -69.2, rot: PI / 2 }); locker(w, { x: -21.5, z: -69.85, rot: PI / 2, ajar: 0.4 });
    lamps([[-14, -71, 'dying', 0.85, 1.2], [-10, -77, 'buzz', 0.8, 1.1], [-18, -78, 'dead'], [-8, -70, 'dying', 0.6, 1.0]]);
    glowSpot(w, { x: -14, y: 1.0, z: -78, size: 2.4, opacity: 0.16 });
    decal(w, { kind: 'puddle', seed: 71, x: -12, y: 0.025, z: -76, w: 2.8, h: 2.8 }); decal(w, { kind: 'splat', seed: 72, x: -17, y: 0.02, z: -75, w: 1.6, h: 1.6 }); decal(w, { kind: 'hand', seed: 73, x: -21.84, y: 1.3, z: -75, w: 0.5, h: 0.5, face: 'e' });
    stencil(w, 'THE DIRECTOR\'S SAFE', { x: -14, y: 3.6, z: -80.82, rot: 0, width: 4.4, size: 0.3 });
    stencil(w, 'MINUTES · INDEX · HYMN · DOSE', { x: -14, y: 3.0, z: -80.82, rot: 0, width: 5, size: 0.24, color: '#c8a44a' });
    const safe = safeBox(w, { x: -14, z: -80.8, nx: 0, nz: 1 });
    // the exit corridor
    room(w, { x: 4, z: -85, w: 4.6, d: 8, h: HT, sides: { s: false }, floorKind: 'tile', wallKind: 'tile' });
    lamps([[4, -84, 'strobe', 0.5, 1.0, PI / 2], [4, -87, 'dying', 0.8, 1.0]]);
    exitDoor(w, { x: 4, z: -88.4, rot: 0 });
    stencil(w, 'LIFT TO THE LOWER WARDS', { x: 4, y: 3.3, z: -81.18, rot: PI, width: 3.6, size: 0.3 });

    // ================================================================ the Orderly ================================================
    const NODES = [
      { id: 'g1', x: 0, z: -10 }, { id: 'g2', x: 0, z: -21 }, { id: 'g3', x: 0, z: -31 },
      { id: 'a', x: 0, z: -59 }, { id: 'ae', x: 8.4, z: -59 }, { id: 'b1', x: 12.5, z: -62.8 }, { id: 'b2', x: 22, z: -64.5 }, { id: 'bd', x: 22, z: -67 },
      { id: 'l1', x: 22, z: -69.4 }, { id: 'l2', x: 21.5, z: -74.6 }, { id: 'lw', x: 11.5, z: -74.2 }, { id: 'ce', x: 8, z: -74.2 }, { id: 'c1', x: 2, z: -72.8 },
      { id: 'c2', x: 2, z: -76.4 }, { id: 'cw', x: -5, z: -74.2 }, { id: 'sx', x: -9, z: -74.2 }, { id: 's1', x: -14, z: -72 }, { id: 's2', x: -12, z: -77 }, { id: 'sd', x: -8, z: -68.6 }, { id: 'as', x: -8, z: -64 },
    ];
    const st = stalker(w, game, H, S, { nodes: NODES, route: ['g1', 'g3', 'g2'], start: 'g3', sight: 12, hear: 6, pause: 2.4, speed: 1.7, home: 'g3' });
    st.setActive(false);
    st.chaseSpeed = 5.0;
    st.hideSpot({ x: -6.0, z: -9.2, w: 1.5, d: 2.6 }); st.hideSpot({ x: 6.0, z: -9.2, w: 1.5, d: 2.6 }); st.hideSpot({ x: -6.1, z: -33.2, w: 1.5, d: 1.8 }); st.hideSpot({ x: 6.1, z: -33.2, w: 1.5, d: 1.8 });
    st.hideSpot({ x: 24.9, z: -53.8, w: 1.6, d: 2.8 }); st.hideSpot({ x: 24.9, z: -64.8, w: 1.6, d: 2.8 }); st.hideSpot({ x: 24.9, z: -70, w: 1.6, d: 2.8 });
    st.hideSpot({ x: -5.0, z: -77.5, w: 1.6, d: 2.6 }); st.hideSpot({ x: 8.9, z: -78.5, w: 1.6, d: 2.6 }); st.hideSpot({ x: -6.3, z: -78.5, w: 1.6, d: 2.6 }); st.hideSpot({ x: -21.1, z: -69.5, w: 1.4, d: 1.8 });
    st.hideSpot({ x: -23.1, z: -64.8, w: 1.4, d: 2.0 });
    st.skip = (role) => D_v.locked && role === R.subject;       // sealed in the vault: he cannot reach them, so he hunts the one outside

    // ================================================================ doors (after the Orderly so he walks through them) =========
    D0 = door(w, { x: 0, z: -7, along: 'x', width: 2.6, key: 'in', locked: true, label: 'door', game });
    const D_st = door(w, { x: -7, z: -16, along: 'z', width: 2.2, key: 'st', label: 'study door', game });
    const D_mr = door(w, { x: 7, z: -16, along: 'z', width: 2.2, key: 'mr', locked: true, label: 'mirror room door', game });
    const D_sc = door(w, { x: 0, z: -35, along: 'x', width: 2.6, key: 'sc', locked: true, label: 'screening room door', game });
    const D_scn = door(w, { x: 5.5, z: -51, along: 'x', width: 2.2, key: 'scn', locked: true, label: 'strongroom door', game });
    const D_v = door(w, { x: -10, z: -59, along: 'z', width: 2.4, key: 'vault', label: 'vault door', game });
    const D_ve = door(w, { x: 10, z: -59, along: 'z', width: 2.2, key: 'be', locked: true, open: false, label: 'boardroom door', game });
    const D_sf = door(w, { x: -8, z: -67, along: 'x', width: 2.0, key: 'sfd', locked: true, label: 'private door', game });
    const D_bn = door(w, { x: 22, z: -67, along: 'x', width: 2.0, key: 'bn', label: 'library door', game });
    const D_lc = door(w, { x: 10, z: -74, along: 'z', width: 2.0, key: 'lc', label: 'chapel door', game });
    const D_cs = door(w, { x: -6, z: -74, along: 'z', width: 2.0, key: 'cs', label: 'safe room door', game });
    const D_exit = door(w, { x: 4, z: -81, along: 'x', width: 2.4, key: 'exit', locked: true, label: 'lift gate', game });
    const ringDoors = [[D_ve, 10, -59], [D_sf, -8, -67], [D_bn, 22, -67], [D_lc, 10, -74], [D_cs, -6, -74]];
    // the reveal rooms shut themselves behind you (so the Orderly never sees in), and he opens a door when he reaches it
    const autoShut = [[D_st, -7, -16], [D_mr, 7, -16]];
    let shutT = 0;
    w.updaters.push((dt) => {
      if (!host) return;
      shutT += dt; if (shutT < 0.5) return; shutT = 0;
      const g = game.player, P = c.partner;
      for (const [D, x, z] of autoShut) {
        const near = Math.hypot(g.x - x, g.z - z) < 3.4 || (P.has && Math.hypot(P.sx - x, P.sz - z) < 3.4);
        D._away = near ? 0 : (D._away || 0) + 0.5;
        if (D.open && !D.locked && D._away > 3.5) D.setOpen(false);
      }
      if (st.on) for (const [D, x, z] of ringDoors) if (!D.open && !D.locked && Math.hypot(st.x - x, st.z - z) < 3.6) D.setOpen(true);
      if (st.on && !D_st.open && Math.hypot(st.x + 7, st.z + 16) < 3) { /* he does not open the offices */ }
    });

    // ================================================================ gallery beats =============================================
    const Z_ = Z;
    trip('gal', { x: 0, y: 1, z: -9.5, w: 12, h: 3, d: 2 }, () => {
      sayAll('lt.c7.gallery', { priority: 2 });
      hostDo(() => { st.setActive(true); st.warp(0, -31); st.hunt = false; });
      w.after(14, () => sayAll('lt.c7.orderly'));
      w.after(34, () => Z_.behind('patient', { role: me, dist: 3.4, dur: 10 }));
    });
    trip('study', { x: -13, y: 1, z: -16, w: 10, h: 3, d: 8 }, () => { sayAll('lt.c7.study', { priority: 2 }); });
    trip('mirror', { x: 12, y: 1, z: -16, w: 10, h: 3, d: 8 }, () => { sayAll('lt.c7.mirror', { priority: 2 }); });

    // ================================================================ 4. the mirror (a different figure for each of you) ========
    const tint = (f, from, to) => f.group.traverse((o) => { if (o.material?.color && o.material.color.getHex() === from) o.material.color.setHex(to); });
    const mir = { st: 'idle', t: 0, fig: null, done: false, hist: [], phase: 0, tx: 0, tz: 0 };
    const mirLines = {
      keyholder: { fog: [['YOU HELD', 'THE KEY.'], ['YOU HOLD', 'THE KEY.']], k: ['lt.c7.mir.k1', 'lt.c7.mir.k2', 'lt.c7.mir.k3', 'lt.c7.mir.k4'] },
      subject: { fog: [['YOU', 'ASKED.'], ['THEY SAID', 'YES.']], k: ['lt.c7.mir.s1', 'lt.c7.mir.s2', 'lt.c7.mir.s3', 'lt.c7.mir.s4'] },
    };
    w.updaters.push((dt) => {
      if (mir.done) return;
      const g = game.player;
      const inRoom = g.x > 8 && g.x < 18.5 && g.z > -20.6 && g.z < -11.4 && c.get('rv1:' + me, false);
      if (mir.fig) mir.fig.group.visible = inRoom;
      if (!inRoom) return;
      const dx = MIR.x - g.x, dz = MIR.z - g.z, d = Math.hypot(dx, dz) || 1;
      const facing = (-Math.sin(game.yaw) * dx + -Math.cos(game.yaw) * dz) / d;
      if (mir.st === 'idle') {
        if (facing > 0.55 && d < 9) {
          mir.st = 'mimic'; mir.t = 0; mir.fig = figure(w, { kind: 'patient' }); tint(mir.fig, 0x6a7670, R.is('keyholder') ? 0xdcdccf : 0x6f7d86);
          mir.phase = 0; tell(me, mirLines[R.mine].k[0], { priority: 2 }); S.whisper(0, 1.4, 0.08);
        } else return;
      }
      const F = mir.fig; if (!F) return;
      mir.hist.push({ t: w.t, x: g.x, z: g.z, yaw: game.yaw }); while (mir.hist.length && mir.hist[0].t < w.t - 1.2) mir.hist.shift();
      const sp = Math.hypot(g.vx || 0, g.vz || 0); mir.phase += dt * (3 + sp * 1.4);
      const place = (px, pz, yw) => { F.set(Math.min(28, 2 * MIR.x - px), 0, pz); F.face(PI - yw); F.pose(mir.phase, Math.min(1, sp / 6), 0, w.t); };
      if (facing > 0.1 || mir.st === 'touch') mir.t += dt;
      if (mir.st === 'mimic') {
        place(g.x, g.z, game.yaw);
        if (mir.t > 8) { mir.st = 'drift'; mir.t = 0; S.static(0.25, 0.05); }
      } else if (mir.st === 'drift') {
        const q = mir.hist[0] || { x: g.x, z: g.z, yaw: game.yaw }; place(q.x, q.z, q.yaw);                    // it is a second late, and getting later
        if (mir.t > 6) { mir.st = 'still'; mir.t = 0; mir.tx = F.group.position.x; mir.tz = F.group.position.z; tell(me, mirLines[R.mine].k[1], { priority: 2 }); S.heart(true, 1.2); }
      } else if (mir.st === 'still') {
        F.set(mir.tx, 0, mir.tz); F.face(Math.atan2(g.x - mir.tx, g.z - mir.tz)); F.pose(0, 0, 0, w.t * 0.5); F.twitch = 0.5;
        if (mir.t > 4 && mir.phase < 1e8) { mir.phase = 1e9; glass.fog(mirLines[R.mine].fog[0]); S.whisper(0.7, 1.6, 0.1); }
        if (mir.t > 9 && mir.phase < 2e9) { mir.phase = 2e9; glass.fog(mirLines[R.mine].fog[1]); tell(me, mirLines[R.mine].k[2], { priority: 2 }); Z.shake(0.4); }
        if (mir.t > 16) { mir.st = 'touch'; mir.t = 0; }
      } else if (mir.st === 'touch') {
        const tx = MIR.x + 0.7, tz = g.z * 0.5 + MIR.z * 0.5; const p = F.group.position;
        const k = Math.min(1, dt * 0.9); p.x += (tx - p.x) * k; p.z += (tz - p.z) * k; F.face(PI / 2); F.pose(w.t * 4, 0.3, 0.4, w.t);
        if (Math.abs(p.x - tx) < 0.5 || mir.t > 6) {
          mir.st = 'end'; glass.clear(); glass.crack(7); Z.blackout(2.0); S.slam(0.35); game.shake = Math.max(game.shake || 0, 0.8);
          w.after(2.1, () => { Z.sting(0.5); F.group.visible = false; tell(me, mirLines[R.mine].k[3], { priority: 2 }); });
          w.after(2.2, () => { mir.done = true; w.scene.remove(F.group); S.heart(false); c.set('rv2:' + me, true); });
        }
      }
    });
    c.on('rv2:p1', () => rv2Check()); c.on('rv2:p2', () => rv2Check());
    const rv2Check = () => {
      if (c.get('rv2:p1', false) && c.get('rv2:p2', false)) hostDo(() => { if (D_sc.locked) { D_sc.unlock(); sayAll('lt.c7.rv2.open', { priority: 2 }); } });
      else if (c.get('rv2:' + me, false) && !w._rv2w) { w._rv2w = true; w.after(5, () => tell(me, 'lt.c7.rv2.wait')); }
    };

    // ================================================================ 5. the film (a different film for each of you) ===========
    const film = {
      keyholder: [
        [0, 'lt.c7.reel.k1'], [9, 'lt.c7.reel.k2'], [20, 'lt.c7.reel.k3'], [32, 'lt.c7.reel.k4'], [44, 'lt.c7.reel.k5'], [56, 'lt.c7.reel.k6'], [68, 'lt.c7.reel.k7'],
      ],
      subject: [
        [0, 'lt.c7.reel.s1'], [9, 'lt.c7.reel.s2'], [20, 'lt.c7.reel.s3'], [32, 'lt.c7.reel.s4'], [44, 'lt.c7.reel.s5'], [56, 'lt.c7.reel.s6'], [68, 'lt.c7.reel.s7'],
      ],
    };
    c.onEvent('c7:reel', () => {
      if (reelT >= 0 || reelDone) return; reelT = 0; S.groan(0.12); S.static(0.5, 0.08); PR.beam.material.opacity = 0.05;
      for (const [t, k] of film[R.mine]) w.after(t, () => tell(me, k, { priority: 2 }));
      w.after(REEL - 3, () => { Z.flash(0.9, 160); S.static(0.8, 0.2); });
      w.after(REEL, () => {
        reelT = -1; reelDone = true; PR.beam.material.opacity = 0; Z.sting(0.55); Z.blackout(2.4);
        w.after(2.6, () => { Z.stand('orderly', 0, -37.4, { role: 'all', dur: 6 }); });
        w.after(4, () => {
          const L = ['lt.c7.desk.1', 'lt.c7.desk.2', 'lt.c7.desk.3', 'lt.c7.desk.4', 'lt.c7.desk.5', 'lt.c7.desk.6'];
          L.forEach((k, i) => w.after(i * 6.5, () => tell('all', k, { priority: 2 })));
          w.after(L.length * 6.5 + 1.5, () => { c.set('rv3:' + me, true); });
        });
      });
    });
    w.updaters.push((dt) => { if (reelT >= 0) reelT += dt; });
    c.on('rv3:p1', () => rv3Check()); c.on('rv3:p2', () => rv3Check());
    const rv3Check = () => {
      if (c.get('rv3:p1', false) && c.get('rv3:p2', false)) hostDo(() => { if (D_scn.locked) { D_scn.unlock(); D_scn.setOpen(true); sayAll('lt.c7.rv3.open', { priority: 2 }); } });
    };
    const drawFilm = (g, cw, ch, t, tt) => {
      const R_ = R.mine, k = R_ === 'keyholder';
      g.fillStyle = '#05080a'; g.fillRect(0, 0, cw, ch);
      if (tt < 0) {
        if (reelDone) { g.fillStyle = '#d8e4ea'; g.fillRect(0, 0, cw, ch); g.fillStyle = '#05080a'; g.font = '700 22px "Courier New", monospace'; g.textAlign = 'center'; g.fillText('END OF REEL', cw / 2, ch / 2); return; }
        g.fillStyle = 'rgba(200,220,230,0.5)'; g.font = '700 20px "Courier New", monospace'; g.textAlign = 'center'; g.fillText(Math.sin(t * 2) > 0 ? 'REEL 7 · LOADED' : 'REEL 7', cw / 2, ch / 2); return;
      }
      const sc = Math.min(6, Math.floor(tt / 11.4)), lt = tt - sc * 11.4;
      const bg = g.createLinearGradient(0, 0, 0, ch); bg.addColorStop(0, '#16221f'); bg.addColorStop(1, '#0a100f'); g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
      const person = (x, y, hgt, col, lean = 0) => { g.fillStyle = col; g.beginPath(); g.arc(x + lean, y - hgt, hgt * 0.13, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - hgt * 0.16 + lean * 0.5, y - hgt * 0.86); g.lineTo(x + hgt * 0.16 + lean * 0.5, y - hgt * 0.86); g.lineTo(x + hgt * 0.22, y); g.lineTo(x - hgt * 0.22, y); g.fill(); };
      const floorY = ch * 0.82; g.fillStyle = '#0c1412'; g.fillRect(0, floorY, cw, ch - floorY);
      const bob = Math.sin(t * 3) * 2;
      if (sc === 0) { g.fillStyle = '#1d2a26'; g.fillRect(90, floorY - 46, 190, 10); g.fillRect(110, floorY - 36, 8, 36); person(190, floorY - 40, 110, '#6b7f78'); person(380, floorY, 190, k ? '#c8d0c8' : '#9aa8a2', bob * 0.2); g.fillStyle = '#d8d0b0'; g.fillRect(170, floorY - 52, 40, 4); }
      else if (sc === 1) { person(200, floorY, 160, '#8da39a'); person(330 + Math.sin(t * 1.5) * 4, floorY, 190, k ? '#c8d0c8' : '#9aa8a2'); g.strokeStyle = '#d8d0b0'; g.lineWidth = 3; g.beginPath(); g.moveTo(236, floorY - 80); g.lineTo(300, floorY - 84); g.stroke(); }
      else if (sc === 2) { g.fillStyle = '#26332e'; g.fillRect(150, floorY - 60, 280, 18); g.fillRect(150, floorY - 42, 6, 42); g.fillRect(424, floorY - 42, 6, 42); g.fillStyle = '#7f948c'; g.fillRect(180, floorY - 82, 190, 22); g.beginPath(); g.arc(165, floorY - 74, 17, 0, 7); g.fill(); person(440, floorY, 200, k ? '#c8d0c8' : '#9aa8a2', -14); g.strokeStyle = '#e8e0c0'; g.beginPath(); g.moveTo(420, floorY - 120); g.lineTo(380, floorY - 96); g.stroke(); }
      else if (sc === 3) { if (k) { person(300, floorY, 190, '#c8d0c8', Math.sin(t) * 6); g.fillStyle = `rgba(255,214,120,${0.6 + Math.sin(t * 8) * 0.2})`; g.beginPath(); g.arc(330, floorY - 112, 9, 0, 7); g.fill(); } else { g.fillStyle = '#16201c'; g.fillRect(330, 20, 6, floorY); person(260, floorY, 170, '#8da39a', 10); g.fillStyle = '#d8d0b0'; g.font = '700 24px "Courier New", monospace'; g.textAlign = 'left'; g.fillText('BLUE  YELLOW  RED', 350, 90); g.fillText('BELL  EARTH  BED', 350, 122); } }
      else if (sc === 4) { g.strokeStyle = '#1e2c28'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.strokeRect(120 + i * 40, 60 + i * 20, 400 - i * 80, 200 - i * 36); } g.fillStyle = '#0a0f0e'; g.fillRect(270, 130, 100, 110); person(k ? 200 : 450, floorY, 190, k ? '#c8d0c8' : '#8da39a'); }
      else if (sc === 5) { if (k) { g.fillStyle = '#d0d8d0'; for (const ex of [220, 380]) { g.beginPath(); g.ellipse(ex, 140, 60, 26, 0, 0, 7); g.fill(); g.fillStyle = '#05080a'; g.beginPath(); g.arc(ex + Math.sin(t * 2) * 8, 140, 14, 0, 7); g.fill(); g.fillStyle = '#d0d8d0'; } } else { for (let i = 0; i < 8; i++) { g.fillStyle = i === 4 ? '#6a7a4a' : '#26332e'; g.fillRect(70 + i * 62, 90, 54, 56); g.fillStyle = '#d8d0b0'; g.font = '700 22px "Courier New", monospace'; g.textAlign = 'center'; g.fillText(String(i + 1), 97 + i * 62, 126); } g.strokeStyle = '#ffd56a'; g.lineWidth = 3; g.strokeRect(318, 84, 66, 68); } }
      else { g.strokeStyle = '#c8c8b8'; g.lineWidth = 4; for (let s = 0; s < 7; s++) for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(80 + s * 70 + i * 9, 80 + (s % 3) * 40); g.lineTo(80 + s * 70 + i * 9, 130 + (s % 3) * 40); g.stroke(); } g.fillStyle = '#d8d0b0'; g.font = '700 22px "Courier New", monospace'; g.textAlign = 'center'; g.fillText('ATTEMPT 7', cw / 2, floorY - 4); }
      const cap = ['NIGHT 1 · 22:14', 'NIGHT 1 · 22:31', 'NIGHT 3 · 02:50', 'NIGHT 5 · 03:12', 'NIGHT 6 · 23:48', 'NIGHT 7 · 01:05', 'THE EQUINOX'][sc];
      g.fillStyle = '#c8d8d0'; g.font = '700 15px "Courier New", monospace'; g.textAlign = 'left'; g.fillText('CAM 4 · WARD B', 14, 22); g.fillText(cap, 14, ch - 12); g.textAlign = 'right'; g.fillText('● REC', cw - 14, 22);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; g.fillRect(Math.random() * cw, Math.random() * ch, 1 + Math.random() * 3, 1); }
      g.fillStyle = 'rgba(0,0,0,.2)'; for (let y = 0; y < ch; y += 3) g.fillRect(0, y, cw, 1);
      if (lt < 0.5 || lt > 10.6) { g.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.4})`; g.fillRect(0, Math.random() * ch, cw, 2 + Math.random() * 10); }
      if (tt > REEL - 4) { g.fillStyle = `rgba(255,255,255,${Math.min(1, (tt - (REEL - 4)) / 4)})`; g.fillRect(0, 0, cw, ch); }
    };

    // ================================================================ 6/7. the strongroom lobby, the power, the bolt ================
    trip('ante', { x: 0, y: 1, z: -55, w: 18, h: 3, d: 6 }, () => {
      sayAll('lt.c7.ante', { priority: 2 });
      w.after(16, () => sayAll('lt.c7.ante2'));
    });
    let winEnd = -1, winOpen = false, hud = null;
    if (R.is('keyholder')) hud = privateHud(w);
    const vaultZone = c.zone({ x: -17, y: 1, z: -60, w: 12, h: 3, d: 12, need: 'any', shrink: 0 });
    const subjectInVault = () => (R.subject === 'p1' ? vaultZone.p1 : vaultZone.p2);
    c.onEvent('c7:power', () => {
      if (powered) return; powered = true; S.bell(0, 0.14); S.door(0, 0.3);
      sayAll('lt.c7.power', { priority: 2 });
      hostDo(() => { D_ve.unlock(); D_sf.unlock(); st.setActive(true); st.warp(2, -76.4); st.home = 'c2'; st.setRoute(['a', 'ae', 'b1', 'b2', 'bd', 'l1', 'l2', 'lw', 'ce', 'c1', 'cw', 'sx', 's1', 'sd', 'as']); st.huntHold = 4; });
      winEnd = w.t + WINDOW; winOpen = true;
      w.after(2.5, () => whisper('lt.c7.k.bolt', 'lt.c7.s.power'));
      if (R.is('keyholder')) { hud.show('THE BOLT', 'ONLY YOU CAN SEE THIS'); w.after(WINDOW - 30, () => { if (winOpen) tell(me, 'lt.c7.k.30', { priority: 2 }); }); }
      w.after(60, () => { if (!c.get('c7:lock', false)) sayAll('lt.c7.route', { priority: 1 }); });
    });
    w.updaters.push(() => {
      if (!winOpen) return;
      const left = winEnd - w.t;
      if (hud && hud.on) hud.time(left);
      if (left <= 0 || c.get('c7:lock', false)) {
        winOpen = false;
        if (hud) { hud.text(c.get('c7:lock', false) ? 'BOLTED' : 'PASSED'); w.after(5, () => hud.hide()); if (!c.get('c7:lock', false)) tell(me, 'lt.c7.k.passed', { priority: 2 }); }
      }
    });
    const lv = bolt.levers[0];
    press({
      x: lv.x, y: 1.2, z: lv.z, bw: 0.6, bh: 1.4, bd: 0.9, range: 3.0,
      label: () => (!R.is('keyholder') ? 'Bolt panel (staff only)' : c.get('c7:lock', false) && D_v.locked ? 'Draw the bolt' : winOpen && subjectInVault() ? 'Throw the bolt' : winOpen ? 'Throw the bolt (nobody is inside)' : 'The bolt'),
      enabled: () => !D_v.open || D_v.locked,
      onUse: () => {
        if (!R.is('keyholder')) { tell(me, 'lt.c7.bolt.staff', { priority: 1 }); S.squeak(0, 0.06); return; }
        if (D_v.locked) { c.emit('c7:release'); return; }
        if (!winOpen) { tell(me, 'lt.c7.bolt.late', { priority: 1 }); return; }
        if (!subjectInVault()) { tell(me, 'lt.c7.bolt.empty', { priority: 1 }); return; }
        c.emit('c7:lock');
      },
    });
    c.onEvent('c7:lock', () => {
      if (c.get('c7:lock', false) || w._locked) return; w._locked = true; c.set('c7:lock', true);
      S.slam(0.5); S.door(0, 0.4); bolt.set(0, true);
      hostDo(() => D_v.lock());
      if (R.is('keyholder')) {
        R.flag('locked-in', true);
        import('../hotel/escape-kit.js').then(({ readModal }) => readModal(game, { title: 'OVERRIDE CARD', html: '<b>SAFE · STAFF OVERRIDE</b><p>Attending only. If the patient is not available to supply the dose:</p><p style="font-size:30px;letter-spacing:.3em;text-align:center"><b>DOSE &nbsp;6</b></p><p style="opacity:.7">This card is printed when the bolt is thrown. It is printed whether or not you wanted it.</p>' }));
        w.after(3, () => tell(me, 'lt.c7.k.locked', { priority: 2 }));
        w.after(20, () => tell(me, 'lt.c7.k.go', { priority: 1 }));
      } else {
        w.after(0.8, () => tell(me, 'lt.c7.s.locked', { priority: 2 }));
        w.after(12, () => { if (!breach && D_v.locked) tell(me, 'lt.c7.s.temp', { priority: 2 }); });
        w.after(40, () => { if (!breach && D_v.locked && !toolHere()) tell(me, 'lt.c7.s.hint', { priority: 1 }); });
      }
      hostDo(() => { st.hunt = true; st.huntHold = 3; });
    });
    c.onEvent('c7:release', () => {
      if (!D_v.locked) return; S.door(0, 0.3); bolt.set(0, false);
      hostDo(() => { D_v.unlock(); w.after(0.5, () => D_v.setOpen(true)); });
      if (R.is('keyholder')) { R.flag('ch7-released', true); w.after(1.5, () => tell(me, 'lt.c7.k.released', { priority: 2 })); } else w.after(1.2, () => tell(me, 'lt.c7.s.released', { priority: 2 }));
    });
    // guilt: someone knocking from inside while it is bolted
    let knockT = 0;
    w.updaters.push((dt) => { if (!D_v.locked || breach) return; knockT += dt; if (knockT > 26) { knockT = 0; if (R.is('keyholder')) Z.knock({ n: 3 }); } });
    // hunting: whoever is alone. Sealed in = the Keyholder is alone for certain; unsealed = alone only when far apart.
    w.updaters.push(() => {
      if (!host || !powered || !st.on) return;
      const g = game.player, P = c.partner, apart = P.has && Math.hypot(P.sx - g.x, P.sz - g.z) > 16;
      st.hunt = D_v.locked || apart;
    });

    // ---- the breach (the Subject's sabotage ends here) ----
    c.onEvent('c7:breach', () => {
      if (breach) return; breach = true;
      const lampsOld = vaultLamps.map((L) => L.mode); vaultLamps.forEach((L) => { L.mode = 'strobe'; });
      S.alarm(0.12); S.groan(0.3); overload.set(0, true);
      let t = 0; const sparkU = (dt) => { t += dt; panel.spark.intensity = (Math.random() < 0.5 ? 1 : 0) * 14 * Math.min(1, t / 2); };
      w.updaters.push(sparkU);
      hostDo(() => st.noise(-9, -59, 22));
      if (R.is('subject')) { tell(me, 'lt.c7.breach.s', { priority: 2 }); w.after(5, () => Z.sting(0.5)); }
      else tell(me, 'lt.c7.breach.k', { priority: 2 });
      w.after(5, () => S.alarm(0.12)); w.after(7, () => S.wail(0.12));
      w.after(11.5, () => {
        hostDo(() => { D_v.unlock(); D_v.setOpen(true); });
        S.slam(0.55); vaultLamps.forEach((L, i) => { L.mode = lampsOld[i]; }); panel.spark.intensity = 0; const ix = w.updaters.indexOf(sparkU); if (ix >= 0) w.updaters.splice(ix, 1);
        if (R.is('subject')) { R.flag('ch7-sabotaged', true); tell(me, 'lt.c7.breach.out', { priority: 2 }); } else tell(me, 'lt.c7.breach.kout', { priority: 2 });
        hostDo(() => { st.huntHold = 0; });
      });
    });

    // ================================================================ 8. the safe, the key, the exit =============================
    const dial = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      safe.setDial(i, 0);
      c.on('sf:' + i, (v) => { dial[i] = v | 0; safe.setDial(i, dial[i]); S.squeak(0.1, 0.04); if (host && dial.every((q, k) => q === CODE[k]) && !c.get('sf:open', false)) c.set('sf:open', true); });
      const dp = safe.dial(i);
      press({ x: dp.x, y: 1.3, z: dp.z, bw: 0.34, bh: 1.2, bd: 0.5, label: () => `Dial ${i + 1} (${dial[i]})`, enabled: () => !c.get('sf:open', false), onUse: () => { c.set('sf:' + i, (dial[i] + 1) % 10); confirm(); } });
    }
    let safeK = 0, keyTaken = false;
    c.on('sf:open', (v) => { if (!v) return; S.door(0, 0.35); S.groan(0.1); sayAll('lt.c7.safe', { priority: 2 }); safe.glint.intensity = 6; });
    w.updaters.push((dt) => { const want = c.get('sf:open', false) ? 1 : 0; safeK += (want - safeK) * Math.min(1, dt * 3); safe.keyHere = !keyTaken; safe.swing(safeK); if (keyTaken) { safe.keyG.visible = false; safe.glint.intensity = 0; } });
    press({
      x: -14, y: 1.1, z: -78.9, bw: 1.2, bh: 1.4, bd: 0.8, label: () => 'Take the key', enabled: () => c.get('sf:open', false) && !c.get('c7:key', ''),
      onUse: () => { c.set('c7:key', me); confirm(); c.emit('c7:keytaken', { by: me }); },
    });
    c.on('c7:key', (v) => { keyTaken = !!v; });
    c.onEvent('c7:keytaken', (a) => {
      if (w._kt) return; w._kt = true; R.flag('ch7-took-key', c.get('c7:key', '') === R.keyholder || a?.by === R.keyholder);
      Z.blackout(2.0); w.after(2.3, () => { sayAll('lt.c7.key', { priority: 2 }); Z.partnerWrong(3, {}); });
      hostDo(() => { st.huntHold = 0; });
      w.after(9, () => { if (D_v.locked && R.is('keyholder')) tell(me, 'lt.c7.k.decide', { priority: 2 }); });
    });
    const holderIs = () => c.get('c7:key', '') === me;
    press({
      x: 6.9, y: 1.3, z: -79.6, bw: 0.7, bh: 1.4, bd: 0.8, label: () => (D_exit.locked ? (holderIs() ? 'Use the key' : 'Keyhole') : 'Keyhole'), enabled: () => D_exit.locked,
      onUse: (g) => { if (holderIs()) { c.emit('c7:exit'); } else if (c.get('c7:key', '')) g.say?.('lt.c7.gate.theyhave', { priority: 1 }); else g.say?.('lt.c7.gate.nokey', { priority: 1 }); },
    });
    box(w, { x: 6.9, y: 1.25, z: -80.78, w: 0.4, h: 0.6, d: 0.08, kind: 'rust', color: 0x1b2022 });
    c.onEvent('c7:exit', () => { if (w._ex) return; w._ex = true; S.door(0, 0.4); hostDo(() => { D_exit.unlock(); D_exit.setOpen(true); }); sayAll('lt.c7.exit', { priority: 2 }); });

    // the Chapel: something is waiting, earned by the long walk
    trip('chapel', { x: 2, y: 1, z: -73, w: 10, h: 3, d: 6 }, (who) => {
      w.after(5, () => { if (!c.get('c7:key', '')) Z.behind('patient', { role: who, dist: 3.2, dur: 10 }); });
    });
    trip('lib', { x: 18, y: 1, z: -74, w: 12, h: 3, d: 8 }, () => { sayAll('lt.c7.lib'); });
    trip('board', { x: 18, y: 1, z: -59, w: 12, h: 3, d: 10 }, (who) => { sayAll('lt.c7.board'); w.after(10, () => Z.rush('patient', { role: who, dist: 9, dur: 0.8, angle: 0 })); });
    trip('saferoom', { x: -14, y: 1, z: -74, w: 12, h: 3, d: 10 }, () => { sayAll('lt.c7.saferoom'); });
    checkpoint(w, { x: 12.4, z: -53 }); checkpoint(w, { x: 20.6, z: -68.4 }); checkpoint(w, { x: 7.2, z: -70 }); checkpoint(w, { x: -9.4, z: -70 });

    // ================================================================ the wing's camera map =======================================
    function drawMap(g, cw, ch, t) {
      g.fillStyle = '#041412'; g.fillRect(0, 0, cw, ch);
      if (!powered) { g.fillStyle = '#9fe9d2'; g.font = '700 20px "Courier New", monospace'; g.textAlign = 'center'; g.fillText('NO SIGNAL', cw / 2, ch / 2 - 10); g.font = '700 13px "Courier New", monospace'; g.fillText('PATIENT WRISTBAND REQUIRED', cw / 2, ch / 2 + 16); g.globalAlpha = 0.16; g.fillStyle = '#000'; for (let y = 0; y < ch; y += 3) g.fillRect(0, y, cw, 1); g.globalAlpha = 1; return; }
      const P = (wx, wz) => [14 + (wx + 24) * 10.2, 12 + (wz + 82) * -1 * 0 + (-(wz) - 51) * 0 + (wz + 90) * 8.4];
      const rect = (x0, z0, x1, z1, label) => { const a = P(x0, z0), b = P(x1, z1); g.strokeStyle = '#38e0b4'; g.lineWidth = 2; g.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); if (label) { g.fillStyle = 'rgba(159,233,210,.8)'; g.font = '700 10px "Courier New", monospace'; g.textAlign = 'center'; g.fillText(label, (a[0] + b[0]) / 2, Math.min(a[1], b[1]) + 12); } };
      rect(-24, -67, -10, -53, 'VAULT'); rect(-10, -67, 10, -51, 'LOBBY'); rect(10, -67, 26, -51, 'BOARDROOM'); rect(10, -81, 26, -67, 'LIBRARY'); rect(-6, -81, 10, -67, 'CHAPEL'); rect(-22, -81, -6, -67, 'SAFE ROOM'); rect(2, -89, 6, -81, 'LIFT');
      const dot = (wx, wz, col, label, r = 5) => { const p = P(wx, wz); g.fillStyle = col; g.beginPath(); g.arc(p[0], p[1], r, 0, 7); g.fill(); g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.arc(p[0], p[1], r + 4 + Math.sin(t * 5) * 2, 0, 7); g.stroke(); if (label) { g.font = '700 10px "Courier New", monospace'; g.textAlign = 'center'; g.fillText(label, p[0], p[1] - 14); } };
      const gp = game.player, pp = c.partner, ins = (x, z) => z < -51 && z > -90 && x > -25 && x < 27;
      if (ins(gp.x, gp.z)) dot(gp.x, gp.z, '#ffffff', (c.names[me] || '').slice(0, 7));
      if (pp.has && !pp.dead && ins(pp.sx, pp.sz)) dot(pp.sx, pp.sz, '#7fe8ff', (c.names[other] || '').slice(0, 7));
      if (st.on && ins(st.x, st.z)) dot(st.x, st.z, Math.sin(t * 12) > 0 ? '#ff3a2a' : '#a01810', 'ORDERLY', 6);
      const sp = P(-14, -80); g.fillStyle = c.get('sf:open', false) ? '#ffd56a' : '#9fe9d2'; g.fillRect(sp[0] - 4, sp[1] - 4, 8, 8);
      g.fillStyle = '#9fe9d2'; g.font = '700 11px "Courier New", monospace'; g.textAlign = 'left'; g.fillText(D_v.locked ? 'VAULT BOLTED' : 'VAULT OPEN', 14, ch - 12); g.textAlign = 'right'; g.fillText(bellCool > 0 ? `BELL ${Math.ceil(bellCool)}s` : 'BELLS READY', cw - 14, ch - 12);
      g.globalAlpha = 0.16; g.fillStyle = '#000'; for (let y = 0; y < ch; y += 3) g.fillRect(0, y, cw, 1); g.globalAlpha = 1;
    }

    // ================================================================ names on the empty frame, once the names are known ==========
    w.after(1, () => { void names(); });

    // ================================================================ bots ========================================================
    const near = (x, z, r) => { const g = game.player; return Math.hypot(g.x - x, g.z - z) < r; };
    const partnerNear = (x, z, r) => { const P = c.partner; return P.has && Math.hypot(P.sx - x, P.sz - z) < r; };
    const both = (k) => c.get(k + ':p1', false) && c.get(k + ':p2', false);
    const walk = (x, z, r = 0.9) => ({ x, z, r });
    const reader = me === 'p1' ? { x: -10.2, z: -1 } : { x: 10.2, z: -1 };
    const docSteps = [
      walk(0, -9.5), walk(-5, -16, 0.9), { x: -10, z: -16, r: 1.0, until: () => D_st.open || true }, walk(-12.5, -15.2, 0.7),
      { x: -12.5, z: -17.6, r: 1.9, use: true, until: () => w._d1 }, { x: -16.5, z: -14.6, r: 0.9 }, { x: -16.5, z: -12.9, r: 1.9, use: true, until: () => w._d2 },
      { x: -16.3, z: -19.4, r: 0.9 }, { x: -17.8, z: -19.4, r: 1.5, use: true, until: () => c.get('rv1:' + me, false) },
      walk(-10, -16, 0.9), walk(-5, -16, 0.9),
    ];
    void docSteps;
    // papers flag themselves via onRead; track with counters through rv1n
    const common1 = [
      { x: reader.x, z: reader.z, r: 0.5 }, { x: reader.x, z: reader.z, r: 1.3, use: true, until: () => c.get('scan:' + me, false) },
      { x: 0, z: -5, r: 1, until: () => !D0.locked }, walk(0, -8.5), walk(0, -12.5),
      { x: -9, z: -15.4, r: 0.8, until: () => D_st.open || true },
      walk(-11.5, -15.4, 0.9), { x: -12.5, z: -16.2, r: 0.9 }, { x: -12.5, z: -17.6, r: 2.1, use: true, until: () => rv1n >= 1 },
      { x: -16.5, z: -14.4, r: 0.6 }, { x: -16.5, z: -12.9, r: 2.0, use: true, until: () => rv1n >= 2 },
      { x: -16.3, z: -19.4, r: 0.7 }, { x: -17.8, z: -19.4, r: 1.7, use: true, until: () => rv1n >= 3 },
      { x: -12, z: -16, r: 1, until: () => !D_mr.locked }, walk(-8, -16, 0.9), walk(-3, -16, 1.0), walk(4, -16, 1.0), walk(9, -16, 0.9),
      { x: 13.5, z: -16, r: 0.9 }, { x: 15, z: -16, r: 0.9, until: () => mir.done && c.get('rv2:' + me, false) },
      { x: 9, z: -16, r: 1.0, until: () => !D_sc.locked }, walk(4, -16, 0.9), walk(0, -30, 1.0), { x: 0, z: -34, r: 1.0, until: () => !D_sc.locked },
      walk(0, -37, 0.9), { x: 0, z: -37.6, r: 1.0, until: () => scBoth.active }, { x: 0, z: -37.5, r: 1.6, use: true, until: () => reelT >= 0 || reelDone },
      { x: 0, z: -37, r: 0.9, until: () => c.get('rv3:' + me, false) }, { x: 5.5, z: -45, r: 1.0, until: () => !D_scn.locked }, walk(5.5, -50, 0.9), walk(5, -54, 0.9),
    ];
    const fromA = [{ x: 0, z: -57, r: 1.0 }];
    // ---- the Subject
    const unscrew = panel.at(0, 0);
    const subjectSteps = [
      ...common1, ...fromA,
      walk(-8, -59, 0.9), { x: -12, z: -59, r: 1.0, until: () => !D_v.locked || true }, walk(-18.5, -60, 1.0),
      { x: -20.7, z: -60.9, r: 0.8 }, { x: -20.7, z: -60.9, r: 1.0, use: true, until: () => powered },
      { x: -18, z: -61, r: 1.0, until: () => D_v.locked || (!BOT_LOCKS && c.get('c7:key', '') !== '') },
      // sealed in (or not): if sealed, break out; if not, wait for the key
      { x: -18, z: -65.3, r: 0.9, until: () => !D_v.locked || toolHere() }, { x: -18, z: -65.6, r: 1.2, use: true, until: () => !D_v.locked || toolHere() },
      { x: unscrew.x, z: unscrew.z, r: 1.0, until: () => !D_v.locked || !covered() }, { x: unscrew.x, z: unscrew.z, r: 1.2, use: true, until: () => !D_v.locked || !covered() },
      ...[0, 1, 2].flatMap((i) => { const p = panel.at([-0.4, 0, 0.4][i], 0.1); return [{ x: p.x, z: p.z, r: 0.9, until: () => !D_v.locked || wires[i] === SOLUTION[i] }, { x: p.x, z: p.z, r: 1.0, use: true, until: () => !D_v.locked || wires[i] === SOLUTION[i] }]; }),
      { x: ov.x, z: ov.z + 0.5, r: 1.0, until: () => !D_v.locked || armed() }, { x: ov.x, z: ov.z, r: 0.9, use: true, until: () => !D_v.locked || breach },
      { x: -18, z: -60, r: 1.0, until: () => !D_v.locked }, walk(-8, -59, 0.9), walk(0, -59, 1.0),
      { x: 0, z: -64, r: 1.0 }, { x: -8, z: -64.5, r: 0.9 }, { x: -8, z: -69, r: 0.9 }, { x: -9, z: -74, r: 1.0 }, { x: -2, z: -74.2, r: 1.0 },
      { x: 4, z: -78, r: 1.0, until: () => !D_exit.locked }, { x: 4, z: -86, r: 1.0 },
    ];
    // ---- the Keyholder
    const lever = { x: lv.x, z: lv.z };
    const diaPos = [0, 1, 2, 3].map((i) => safe.dial(i));
    const keyholderSteps = [
      ...common1, ...fromA,
      { x: 0, z: -58, r: 1.0, until: () => powered && (!BOT_LOCKS || winOpen) }, { x: -8, z: -58, r: 1.0 },
      ...(BOT_LOCKS ? [{ x: lever.x, z: lever.z, r: 0.6, until: () => c.get('c7:lock', false) || !winOpen }, { x: lever.x, z: lever.z, r: 1.1, use: true, until: () => c.get('c7:lock', false) || !winOpen }] : [{ x: -8, z: -58, r: 1.0, until: () => !winOpen }]),
      { x: 8, z: -59, r: 1.0, until: () => !D_ve.locked }, walk(12.5, -62.8, 0.9),
      { x: 21, z: -57.4, r: 0.8 }, { x: 22.2, z: -57.2, r: 1.9, use: true, until: () => c.get('c7:minutes', false) || true },
      walk(21.5, -64, 0.9), walk(22, -68, 0.9), walk(22, -70, 0.9), walk(22, -73, 0.9),
      { x: 23.8, z: -74.7, r: 1.5, use: true, until: () => true }, walk(14, -74.2, 0.9), walk(8, -74.2, 0.9),
      { x: -4.5, z: -73.3, r: 1.7, use: true, until: () => true }, walk(-3, -74.2, 0.9), walk(-9, -74.2, 0.9), walk(-13, -76, 0.9),
      ...[0, 1, 2, 3].flatMap((i) => [{ x: diaPos[i].x, z: diaPos[i].z - 0.2, r: 0.6 }, { x: diaPos[i].x, z: diaPos[i].z, r: 1.1, use: true, until: () => dial[i] === CODE[i] }]),
      { x: -14, z: -78.2, r: 0.9, until: () => c.get('sf:open', false) }, { x: -14, z: -78.6, r: 1.3, use: true, until: () => !!c.get('c7:key', '') },
      walk(-9, -74.2, 0.9), walk(-3, -74.2, 0.9), { x: 6.2, z: -79.0, r: 1.0 }, { x: 6.9, z: -79.6, r: 1.1, use: true, until: () => !D_exit.locked },
      { x: 4, z: -80, r: 1.0, until: () => !D_v.locked }, { x: 4, z: -86, r: 1.0 },
    ];
    // the Keyholder takes a detour to unseal the vault if the Subject has not broken out in time? (not needed: the Subject breaks out; if not locked there is nothing to do)
    void both; void partnerNear; void near; void Z_;
    botSteps(w, { [R.keyholder]: keyholderSteps, [R.subject]: subjectSteps });
    // the bot Keyholder only learns the minutes etc. by reading; those papers are not needed for the bots (they know the code)
  },
};
