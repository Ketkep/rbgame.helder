import * as THREE from 'three';
import { stalker } from './stalker.js';
import { scares } from './scare.js';
import { roles } from './roles.js';
import { figure } from './figure.js';
import { horrorEnv, floor, exitDoor, checkpoint, door, room, box, decal, locker, wheelchair, pipes, desk, barWindow, stencil, note, wall, gurney } from './kit.js';
import { makeHud, holdable, consoleProp, trolley, screenText } from './intake-kit.js';
import { fuseBox } from './night-rounds-kit.js';
import { bench } from './records-kit.js';
import { drawerBank, handConsole, speechTag, plinth, angel, rainField, lampPost, grave, hedge, candle, pew, slabTable } from './morgue-kit.js';
import { botSteps } from '../coop/kit.js';

// Chapter 6 — The Morgue. Torch-only dark. A second "partner" walks beside you; one of the two is real.
//  1 Reception: agree a word with your partner (the code), then hold two fuses at once.   2 The cold corridor: drawers open when you are not looking.
//  3 The cold room: one holds the cold lock, one pulls; each has half of the drawer list.   4 The viewing hall (round 1): two copies of your partner,
//  each says a word; take the hand of the one that says the word you agreed.   5 The autopsy suite: the Orderly; hold two slab releases at once.
//  6 The chapel (round 2): a handshake console; the copy mirrors your partner a heartbeat late.   7 The garden: torch the angels' eyes together, in the rain.
//  8 The lych-gate (round 3): three consoles, two copies, only one real hand. A wrong hand drops to all fours and charges (hide, or outrun it).

const PI = Math.PI;
const WORDS = ['MOTH', 'TIDE', 'FERN', 'SALT', 'LAMP', 'KNOT'];
const TARGETS = ['B6', 'C12', 'A3'];             // P1's list has the rows (B C A), P2's has the numbers (6 12 3)
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const angDiff = (a, b) => ((b - a + PI * 3) % (PI * 2)) - PI;
const esc = (s) => String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));

export default {
  id: 'lowtide6',
  name: 'The Morgue',
  music: 'l1',
  horror: true,
  deathRule: 'self',
  completeQuip: 'Morgue cleared. Two visitors in, two visitors out. Please do not count.',
  titleCam: { center: [0, 2, -80], radius: 26, height: 12 },

  build(w, game) {
    const H = horrorEnv(w, game, { fogColor: 0x04080b, density: 0.066, ambientSky: 0x2a4450, ambient: 0.22, exposure: 1.5 });
    const c = w.coop, me = c.me, other = c.other, S = H.S, BOT = !!window.__noRender;
    const R = roles(w, game);
    const Z = scares(w, game, H, S);
    w.spawn = { x: me === 'p1' ? -2.2 : 2.2, y: 0, z: 2.5, yaw: 0 };
    w.respawn = { ...w.spawn };
    const hud = makeHud(w, game);
    const tell = (r, k, o) => c.tell(r, k, o);
    const sayAll = (k, o) => tell('all', k, o);
    const sayMe = (k, o) => tell(me, k, o);
    const toast = (t, kind = '') => game.ui?.toast?.(t, kind);
    const pan = (x, z) => { const rel = Math.atan2(x - game.camera.position.x, z - game.camera.position.z) - game.yaw; return Math.max(-1, Math.min(1, Math.sin(rel + PI) * 0.9)); };
    const names = () => ({ M: esc(c.names[me]), O: esc(c.names[other]) });
    const press = ({ x, y = 1.3, z, bw = 0.6, bh = 1.6, bd = 0.6, label, enabled, onUse, range = 3.2 }) => w.interactable({ x, y, z, w: bw, h: bh, d: bd, range, pad: 0.1, label, enabled, onUse });
    const trip = (name, bx, fn, cond) => {
      let fired = false;
      c.onEvent('c6:' + name, (a) => { if (fired) return; fired = true; fn(a?.who || 'p1'); });
      c.zone({ ...bx, need: 'any', shrink: 0 }).onChange((zn) => { if (zn.active && !fired && (!cond || cond())) c.emit('c6:' + name, { who: zn.p1 && !zn.p2 ? 'p1' : zn.p2 && !zn.p1 ? 'p2' : (zn.mine ? me : other) }); });
    };
    const hides = [];                                                                  // boxes where standing still hides you from the copies
    const hideSpot = (b) => hides.push(b);
    let sayCd = 0; const sayMeCd = (k) => { if (w.t < sayCd) return; sayCd = w.t + 4; sayMe(k); };
    const imHidden = () => { const g = game.player; return Math.hypot(g.vx, g.vz) < 0.5 && hides.some((b) => Math.abs(g.x - b.x) < b.w / 2 && Math.abs(g.z - b.z) < b.d / 2); };
    const tiled = { floorKind: 'tile', wallKind: 'tile' };
    const lampsAll = [];
    const lamp = (o) => { const L = H.lamp({ color: 0xbfe6ff, ...o }); lampsAll.push(L); return L; };

    // ============================================================ the copy of your partner =====================================
    const trail = [];
    w.updaters.push(() => { const P = c.partner; if (P.has && !P.dead) { trail.push({ t: w.t, x: P.sx, z: P.sz, yaw: P.yaw || 0, pitch: P.pitch || 0 }); while (trail.length > 1 && trail[0].t < w.t - 5) trail.shift(); } });
    const trailAt = (lag) => { if (!trail.length) return null; const T = w.t - lag; for (let i = trail.length - 1; i >= 0; i--) if (trail[i].t <= T) return trail[i]; return trail[0]; };
    const tagOf = (g) => g.children.find((q) => q.isSprite);
    const makeDouble = (seed) => {
      const clone = game.coop.avatar.clone(true); clone.visible = false; w.scene.add(clone);
      const tag = tagOf(clone), gt = H.ghostTorch();
      const fig = figure(w, { kind: 'patient' });
      fig.group.traverse((o) => { if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); if (o.material.color.getHex() === 0x6a7670) o.material.color.setHex(0x9aa39c); } });
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 6, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(c.roles[other].color).multiplyScalar(2.2), toneMapped: false })); band.rotation.x = PI / 2; band.position.y = 0.95; fig.group.add(band);
      fig.group.visible = false;
      const D = { clone, fig, gt, tag, x: 0, z: 0, yaw: 0, vx: 0, vz: 0, mode: 'off', lag: 1.1, axis: 0, off: 0, dz: 0, fixed: null, placed: false, revealed: false, vis: false, seed, seen: 0, speech: null, tint: 0 };
      D.show = (v) => { D.mode = v ? D.mode : 'off'; };
      D.update = (dt) => {
        let tx = D.x, tz = D.z, tyaw = D.yaw, tp = 0, vis = false;
        if (D.mode === 'fixed' && D.fixed) { tx = D.fixed.x; tz = D.fixed.z; tyaw = D.fixed.yaw; vis = true; }
        else if (D.mode === 'mirror') { const s = trailAt(D.lag); if (s) { tx = D.axis * 2 - s.x; tz = s.z + D.dz; tyaw = -s.yaw; tp = s.pitch; vis = true; } }
        else if (D.mode === 'follow') { const s = trailAt(D.lag); if (s) { tx = s.x + Math.cos(s.yaw) * D.off; tz = s.z - Math.sin(s.yaw) * D.off; tyaw = s.yaw; tp = s.pitch; vis = true; } }
        if (!vis) D.placed = false;
        if (vis && !D.placed) { D.x = tx; D.z = tz; D.placed = true; }
        const ox = D.x, oz = D.z, k = Math.min(1, dt * 14);
        D.x += (tx - D.x) * k; D.z += (tz - D.z) * k;
        D.vx = dt > 0 ? (D.x - ox) / dt : 0; D.vz = dt > 0 ? (D.z - oz) / dt : 0;
        const sp = Math.hypot(D.vx, D.vz);
        D.yaw += angDiff(D.yaw, D.mode === 'fixed' ? tyaw : sp > 0.5 ? Math.atan2(-D.vx, -D.vz) : tyaw) * Math.min(1, dt * 10);
        D.vis = vis && !D.revealed;
        clone.visible = D.vis && D.hiddenBy !== true;
        if (clone.visible) {
          clone.position.set(D.x, 0, D.z); clone.rotation.y = D.yaw; clone.children[0].rotation.x = Math.min(0.3, sp * 0.03);
          const gl = (w.t + D.seed * 3.1) % 9;                                         // a tell: every few seconds the copy glitches for a blink
          const gg = gl < 0.22 ? 1 : 0; clone.scale.set(1 + gg * (hash(Math.floor(w.t * 25)) - 0.5) * 0.4, 1 + gg * (hash(Math.floor(w.t * 25) + 3) - 0.3) * 0.6, 1);
          const p = game.player, d = Math.hypot(D.x - p.x, D.z - p.z);
          if (tag) { tag.visible = d > 1.2; tag.position.y = 2.15 + Math.min(1.2, d * 0.02); tag.scale.setScalar(1 + Math.min(1.5, d * 0.02)); }
          gt.set(D.x, 0, D.z, D.yaw, tp, D.torch !== false);
          if (D.fixed && D.fixed.vanish) {                                             // a glimpse: gone once you look at it
            const cam = game.camera, v = new THREE.Vector3(); cam.getWorldDirection(v);
            const dx = D.x - cam.position.x, dz = D.z - cam.position.z, dd = Math.hypot(dx, dz) || 1;
            if ((v.x * dx + v.z * dz) / dd > 0.9 && dd < 22) D.seen += dt; else D.seen = Math.max(0, D.seen - dt);
            if (D.seen > 1.1) { D.seen = 0; D.mode = 'off'; D.fixed = null; S.static(0.25, 0.07); S.whisper(0, 0.9, 0.1); }
          }
        } else gt.hide();
        if (D.speech) { D.speech.sprite.visible = clone.visible; }
      };
      return D;
    };
    const doubles = [makeDouble(1), makeDouble(2)];
    const [D1, D2] = doubles;
    w.updaters.push((dt) => { for (const D of doubles) D.update(dt); });

    // ---- the charge: a wrong hand drops to all fours --------------------------------------------------------------------
    const charge = { D: null, t: 0, phase: '' };
    const endCharge = () => { const D = charge.D; if (!D) return; D.fig.group.visible = false; D.revealed = false; charge.D = null; S.heart(false); };
    const startCharge = (D) => {
      if (charge.D || game.state !== 'playing') return;
      charge.D = D; charge.t = 0; charge.phase = 'tele'; D.revealed = true; D.clone.visible = false; D.gt.hide(); D.fig.group.visible = true;
      D.fig.set(D.x, 0, D.z); S.sting(0.3); Z.flash(0.5); Z.shake(0.8); S.groan(0.2); S.heart(true, 1.7); H.stutter(2.2);
      sayMe('lt.c6.wrong'); c.emit('c6:wrongfx', { by: me });
    };
    c.onEvent('c6:wrongfx', (a) => { if (a?.by !== me) { S.whisper(Math.random() < 0.5 ? -0.8 : 0.8, 1.2); sayMe('lt.c6.wrong.partner'); } });
    w.hooks.frame = ((prev) => (dt, g) => {
      prev?.(dt, g);
      const D = charge.D; if (!D) return;
      if (g.state !== 'playing') { endCharge(); return; }
      const F = D.fig, cam = g.camera.position, dx = cam.x - D.x, dz = cam.z - D.z, dist = Math.hypot(dx, dz) || 1;
      charge.t += dt; F.face(Math.atan2(dx, dz)); F.set(D.x, 0, D.z);
      if (charge.phase === 'tele') {
        F.pose(w.t * 3, 0.1, 0.4, w.t); F.crawl(Math.min(1, charge.t / 0.9), w.t * 5); F.twitch = 1;
        if (charge.t > 2.4) { charge.phase = 'run'; charge.t = 0; S.groan(0.25); }
      } else if (charge.phase === 'run') {
        if (imHidden()) { charge.phase = 'sniff'; charge.t = 0; return; }
        const v = 5.4 * dt; D.x += (dx / dist) * v; D.z += (dz / dist) * v;
        F.pose(w.t * 16, 1, 1, w.t); F.crawl(1, w.t * 14);
        if (dist < 1.0 && !BOT) { endCharge(); g.kill('The Double'); return; }
        if (charge.t > 9) { S.static(0.3, 0.1); endCharge(); }
      } else {
        F.pose(w.t * 2, 0.05, 0.4, w.t); F.crawl(1, 0); F.twitch = 1;
        if (!imHidden() && dist < 9) { charge.phase = 'run'; charge.t = 0; }
        else if (charge.t > 3.4) { S.whisper(0, 1.2, 0.1); S.static(0.3, 0.08); endCharge(); }
      }
    })(w.hooks.frame);
    w.disposers.push(() => { for (const D of doubles) { w.scene.remove(D.clone); } });

    // ---- first-pick bookkeeping (the story flag) ------------------------------------------------------------------------
    const picks = {};
    const recordPick = (round, ok) => { if (!(round in picks)) picks[round] = ok; };
    const finishTrust = () => {
      const v = Object.values(picks); const good = v.filter(Boolean).length;
      R.flag('trusted-' + me, v.length ? good > v.length / 2 : true);
    };
    let flagBoth = false;
    w.updaters.push(() => { if (!flagBoth && c.isHost && R.get('trusted-p1') !== undefined && R.get('trusted-p2') !== undefined) { flagBoth = true; R.flag('trusted', !!(R.get('trusted-p1') && R.get('trusted-p2'))); } });

    // ---- the torch switch (the Orderly sees a lit torch from five metres) -----------------------------------------------
    c.set('torch:' + me, true);
    const onKey = (e) => { if (e.code === 'KeyF' && !e.repeat && game.state === 'playing' && !game.modal) { H.torchOn = !H.torchOn; c.set('torch:' + me, H.torchOn); } };
    window.addEventListener('keydown', onKey); w.disposers.push(() => window.removeEventListener('keydown', onKey));

    // ============================================================ 1 · RECEPTION =================================================
    room(w, { x: 0, z: -2, w: 16, d: 14, doors: { n: [{ c: 0, w: 2.0 }] }, ...tiled });
    stencil(w, 'CHAPTER 6', { x: 3.4, y: 2.95, z: -8.82, rot: 0, width: 3, size: 0.4 }); stencil(w, 'THE MORGUE', { x: 3.4, y: 2.3, z: -8.82, rot: 0, width: 3.8, size: 0.34 });
    stencil(w, 'HEARSE BAY', { x: 0, y: 2.7, z: 4.82, rot: PI, width: 3.2, size: 0.4 });
    box(w, { x: 0, y: 1.3, z: 4.9, w: 5, h: 2.6, d: 0.1, kind: 'rust', color: 0x2c3431 });
    const L0 = [lamp({ x: -3, y: 3.35, z: -2, mode: 'buzz', rot: 0 }), lamp({ x: 3.4, y: 3.35, z: 1.5, mode: 'dying' }), lamp({ x: -4, y: 3.35, z: 2.5, mode: 'dead' }), lamp({ x: 0, y: 3.35, z: -6.3, mode: 'dead', len: 1 })];
    barWindow(w, { x: 7.82, y: 1.9, z: 2.6, rot: -PI / 2 });
    pipes(w, { x0: 7.4, z0: 4.5, x1: 7.4, z1: -8, y: 3.0, n: 2 });
    desk(w, { x: 4.2, z: 0.6, rot: PI / 2 }); bench(w, { x: -5.6, z: 3.2, rot: 0 }); wheelchair(w, { x: 5.4, z: 3.4, rot: 3.6 }); gurney(w, { x: -4.6, z: -2.4, rot: 0.1 });
    decal(w, { kind: 'puddle', seed: 4, x: 1.5, y: 0.025, z: 1.6, w: 3, h: 3 }); decal(w, { kind: 'drag', seed: 11, x: 0, y: 0.02, z: -4, w: 3.2, h: 2.4, face: 'floor', rot: 1.57 });
    decal(w, { kind: 'hand', seed: 6, x: 7.84, y: 1.2, z: -2, w: 0.5, h: 0.5, face: 'e' }); decal(w, { kind: 'scratch', seed: 9, x: -7.84, y: 1.5, z: 3.4, w: 1.4, h: 1.4, face: 'w' });
    note(w, game, { x: 4.2, y: 0.88, z: 0.6, rot: 0, title: 'LOG', label: 'Read the log', html: { all: '<b>MORGUE · NIGHT LOG</b><p>02:10 two admitted, upright. 02:14 refused to lie down.<br>02:31 power to the cold wing cut (storm). Do not restore it by hand.<br>02:40 visitors may stay until the tide.</p><p><i>Nobody signs the log after 02:40. Nobody has to.</i></p>' } });
    checkpoint(w, { x: -3, z: -6 });

    // ---- the Visitors' Book: choose a word together --------------------------------------------------------------------
    const wordPick = { p1: -1, p2: -1 }; let agreed = -1;
    const bcv = document.createElement('canvas'); bcv.width = 768; bcv.height = 384; const bcx = bcv.getContext('2d');
    const btex = new THREE.CanvasTexture(bcv); btex.colorSpace = THREE.SRGBColorSpace;
    const bpl = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshBasicMaterial({ map: btex, toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.15) }));
    bpl.position.set(-7.82, 1.9, -1.0); bpl.rotation.y = PI / 2; w.add(bpl);
    box(w, { x: -7.88, y: 1.9, z: -1.0, w: 0.06, h: 2.0, d: 3.8, kind: 'rust', color: 0x20262a });
    const cellZ = (i) => -2.2 + (i % 3) * 1.2, cellY = (i) => (i < 3 ? 2.35 : 1.5);
    const drawBook = () => {
      bcx.fillStyle = '#0b100e'; bcx.fillRect(0, 0, 768, 384);
      bcx.fillStyle = '#c9d3cc'; bcx.font = '800 26px "Courier New", monospace'; bcx.textAlign = 'center';
      bcx.fillText("VISITORS' BOOK", 384, 36); bcx.font = '600 17px "Courier New", monospace'; bcx.fillStyle = '#8fa39a';
      bcx.fillText(agreed >= 0 ? 'RECORDED. THE WORD IS KEPT ELSEWHERE.' : 'Choose a word together. Say it to no one else.', 384, 64);
      for (let i = 0; i < 6; i++) {
        const cx0 = 36 + (i % 3) * 232, cy0 = 90 + Math.floor(i / 3) * 140;
        bcx.strokeStyle = '#46544e'; bcx.lineWidth = 3; bcx.strokeRect(cx0, cy0, 210, 118);
        bcx.fillStyle = agreed >= 0 ? '#2a3430' : '#d7e4dc'; bcx.font = '800 38px "Courier New", monospace'; bcx.fillText(agreed >= 0 ? '████' : WORDS[i], cx0 + 105, cy0 + 70);
        [['p1', 0], ['p2', 1]].forEach(([r, k]) => { if (wordPick[r] === i) { bcx.fillStyle = c.roles[r].css; bcx.beginPath(); bcx.arc(cx0 + 26 + k * 28, cy0 + 20, 9, 0, 7); bcx.fill(); } });
      }
      if (agreed >= 0) { bcx.fillStyle = 'rgba(61,255,122,.25)'; bcx.fillRect(0, 0, 768, 384); }
      bcx.globalAlpha = 0.14; bcx.fillStyle = '#000'; for (let y = 0; y < 384; y += 3) bcx.fillRect(0, y, 768, 1); bcx.globalAlpha = 1;
      btex.needsUpdate = true;
    };
    drawBook();
    for (let i = 0; i < 6; i++) {
      press({ x: -7.3, y: BOT ? 1.6 : cellY(i), z: cellZ(i), bw: 0.5, bh: BOT ? 2.6 : 0.7, bd: 1.0, range: 3.4, label: () => (agreed >= 0 ? 'The book is closed' : `Choose ${WORDS[i]}${wordPick[me] === i ? ' (chosen)' : ''}`), enabled: () => agreed < 0,
        onUse: () => { c.set('c6:w:' + me, i); S.squeak(0, 0.06); game.audio.confirm?.(); } });
    }
    for (const r of ['p1', 'p2']) c.on('c6:w:' + r, (v) => { wordPick[r] = v | 0; drawBook(); if (agreed < 0 && wordPick.p1 >= 0 && wordPick.p1 === wordPick.p2) { agreed = wordPick.p1; c.set('c6:word', agreed); drawBook(); S.bell(0, 0.18); sayAll('lt.c6.word.done', { priority: 2 }); } });
    c.on('c6:word', (v) => { if (v >= 0 && agreed < 0) { agreed = v; drawBook(); } });
    sayAll('lt.c6.intro', { priority: 2 });
    w.after(14, () => { if (agreed < 0) sayAll('lt.c6.word.hint'); });

    // ---- the two fuses ----------------------------------------------------------------------------------------------------
    let power = false, fuseK = 0;
    const fuses = [{ x: -7.8, z: -5.5, rot: PI / 2, ix: -7.1 }, { x: 7.8, z: -5.5, rot: -PI / 2, ix: 7.1 }].map((f, i) => {
      const fb = fuseBox(w, { x: f.x, z: f.z, rot: f.rot, enabled: () => false });
      const st = holdable(w, game, hud, { x: f.ix, y: 1.3, z: f.z, w: 0.6, h: 1.6, d: 1.0, range: 3.2, bar: 'HOLD THE FUSE', enabled: () => agreed >= 0 && !power, label: (s) => (s.held ? 'Holding the fuse...' : 'Hold the fuse'), tick: () => {} });
      return { fb, st, i };
    });
    w.updaters.push((dt) => {
      if (power) return;
      const hs = fuses.map((f) => f.st.held); c.set('c6:fz:' + me, hs[0] ? 0 : hs[1] ? 1 : -1);
      const a = c.get('c6:fz:p1', -1), b = c.get('c6:fz:p2', -1);
      const both = a >= 0 && b >= 0 && a !== b;
      fuseK = both ? Math.min(1, fuseK + dt / 5) : Math.max(0, fuseK - dt * 0.6);
      for (const f of fuses) { f.st.k = fuseK; f.fb.set(f.st.held || (both && fuseK > 0.02)); }
      if (fuseK >= 1) { power = true; c.emit('c6:power'); }
    });
    const D0 = door(w, { x: 0, z: -9, along: 'x', width: 2.0, key: 'rec', locked: true, label: 'morgue door', game });
    c.onEvent('c6:power', () => {
      power = true; S.door(0, 0.3); S.groan(0.18); H.stutter(1.2); for (const L of L0) L.mode = L.mode === 'dead' ? 'dying' : 'buzz'; lamp({ x: 0, y: 3.35, z: -4.5, mode: 'steady', power: 0.55, len: 0.9 });
      for (const f of fuses) f.fb.set(true);
      sayAll('lt.c6.power', { priority: 2 }); D0.unlock(); D0.setOpen(true);
    });
    trip('lobbyword', { x: 0, y: 1, z: 1, w: 8, h: 3, d: 6 }, () => { w.after(8, () => sayAll('lt.c6.fuse.hint')); });
    trip('cor0', { x: 0, y: 1, z: -10.5, w: 5, h: 3, d: 2 }, () => { sayAll('lt.c6.corridor', { priority: 2 }); });

    // ============================================================ 2 · COLD CORRIDOR =============================================
    room(w, { x: 0, z: -21, w: 6, d: 24, sides: { s: false, n: false }, ...tiled });
    [[-12, 'dead'], [-17, 'dying'], [-22, 'dead'], [-27, 'buzz'], [-31, 'dead']].forEach(([z, m]) => lamp({ x: 0, y: 3.35, z, mode: m, rot: PI / 2, len: 1.3 }));
    pipes(w, { x0: -2.4, z0: -10, x1: -2.4, z1: -32, y: 3.0, n: 2 });
    stencil(w, 'COLD WING', { x: 0, y: 2.7, z: -9.2, rot: 0, width: 2.6, size: 0.36 });
    const cBanks = [];
    for (const zc of [-14, -20.5, -27]) { cBanks.push(drawerBank(w, { x: -2.1, z: zc, rot: PI / 2, cols: 5, id: (r, k) => `W${r}${k}` })); cBanks.push(drawerBank(w, { x: 2.1, z: zc, rot: -PI / 2, cols: 5, id: (r, k) => `E${r}${k}` })); }
    const angels = [];                                                                  // the weeping drawers: they only move when nobody looks
    cBanks.forEach((b, bi) => b.drawers.forEach((d, di) => { if (hash(bi * 31 + di * 7 + 3) > 0.72) angels.push({ d, ux: d.world.x, uz: d.world.z, t: 0, told: false, seen: 0 }); }));
    decal(w, { kind: 'drag', seed: 12, x: 0, y: 0.02, z: -17, w: 2.6, h: 3.4, face: 'floor', rot: 0 }); decal(w, { kind: 'puddle', seed: 7, x: 0.4, y: 0.025, z: -24, w: 2.4, h: 2.4 }); decal(w, { kind: 'splat', seed: 3, x: -0.6, y: 0.02, z: -29, w: 1.6, h: 1.6 });
    gurney(w, { x: 0.3, z: -11.6, rot: 0.3, solid: true });
    let corridorOn = false;
    c.zone({ x: 0, y: 1, z: -21, w: 6, h: 4, d: 26, need: 'any', shrink: 0 }).onChange((zn) => { corridorOn = zn.active; });
    const seenBy = (x, z) => {
      const g = game.player, P = c.partner; let seen = false, near = false;
      const chk = (px, pz, yaw) => { const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz) || 1; if (d < 17) near = true; if (d < 17 && (dx * -Math.sin(yaw) + dz * -Math.cos(yaw)) / d > 0.45) seen = true; };
      chk(g.x, g.z, game.yaw); if (P.has && !P.dead) chk(P.sx, P.sz, P.yaw || 0);
      return { seen, near };
    };
    w.updaters.push((dt) => {
      if (!corridorOn) return;
      for (const a of angels) {
        const { seen, near } = seenBy(a.ux, a.uz);
        if (near && !seen) a.t += dt; else a.t = 0;
        a.d.rate = a.t > 0.7 ? 0.45 : 0; if (a.t > 0.7) a.d.want = 1;
        if (a.d.k > 0.05 && !a.told) { a.told = true; S.scrape(pan(a.ux, a.uz), 0.1); }
      }
    });
    trip('corr-mid', { x: 0, y: 1, z: -21, w: 5, h: 3, d: 1.4 }, () => {
      S.whisper(-0.15, 1.8, 0.16); w.after(2.2, () => R.whisper({ keyholder: 'lt.c6.whisper.k1', subject: 'lt.c6.whisper.s1' }));
      w.after(7, () => { Z.behind('patient', { role: 'all', dist: 3.4, dur: 10 }); });
    });
    trip('corr-end', { x: 0, y: 1, z: -29.5, w: 5, h: 3, d: 1.4 }, () => {
      D1.mode = 'fixed'; D1.fixed = { x: 0, z: -43, yaw: PI, vanish: true }; D1.torch = true;                                // a glimpse of your partner, ahead, facing you
      sayAll('lt.c6.glimpse', { priority: 2 });
    });
    checkpoint(w, { x: 2, z: -31 });

    // ============================================================ 3 · THE COLD ROOM =============================================
    const COLD_N = -55;
    room(w, { x: 0, z: -44, w: 20, d: 22, doors: { s: [{ c: 0, w: 3.0 }], n: [{ c: 5, w: 2.0 }] }, sides: {}, ...tiled });
    stencil(w, 'COLD ROOM', { x: -4, y: 2.9, z: -33.17, rot: PI, width: 3, size: 0.38 });
    [[-38, 'dying'], [-44, 'dead'], [-50, 'buzz'], [-44, 'dead']].forEach(([z, m], i) => lamp({ x: i === 3 ? 6 : i === 1 ? -6 : 0, y: 3.35, z, mode: m, rot: 0, len: 1.4 }));
    const wBank = drawerBank(w, { x: -8.95, z: -44, rot: PI / 2, cols: 8, id: (r, k) => 'ABC'[r] + (k + 1) });
    const eBank = drawerBank(w, { x: 8.95, z: -44, rot: -PI / 2, cols: 8, id: (r, k) => 'ABC'[r] + (16 - k) });
    const DR = {};
    for (const b of [wBank, eBank]) for (const d of b.drawers) DR[d.id] = d;
    slabTable(w, { x: -3.2, z: -41, rot: 0.1 }); slabTable(w, { x: 3.2, z: -47, rot: -0.15 });
    pipes(w, { x0: -9.5, z0: -34, x1: 9.5, z1: -34, y: 3.0, n: 3 });
    decal(w, { kind: 'puddle', seed: 14, x: 0, y: 0.025, z: -44, w: 3.4, h: 3.4 }); decal(w, { kind: 'drag', seed: 22, x: -2, y: 0.02, z: -38, w: 3.4, h: 2.4, face: 'floor', rot: 1.2 }); decal(w, { kind: 'splat', seed: 5, x: 4, y: 0.02, z: -52, w: 2.2, h: 2.2 });
    decal(w, { kind: 'hand', seed: 3, x: -9.84, y: 1.0, z: -35.5, w: 0.5, h: 0.5, face: 'e' });
    // the lists: each of you holds half
    const listHtml = () => ({
      p1: `<b>ADMISSIONS · UNCLAIMED</b> <i>(rows only)</i><p>The attendant wrote the rows and tore off the numbers. In order:</p><p style="font-size:28px;letter-spacing:.3em"><b>B &nbsp;C &nbsp;A</b></p><p>Ask the other one for the numbers. They will have them. Probably.</p>`,
      p2: `<b>TOE-TAG BOOK · UNCLAIMED</b> <i>(numbers only)</i><p>Somebody tore the row letters out of this page. In order:</p><p style="font-size:28px;letter-spacing:.3em"><b>6 &nbsp;12 &nbsp;3</b></p><p>The other one has the letters. Do not read yours aloud near the drawers.</p>`,
    });
    note(w, game, { x: 0, y: 0.88, z: -43.2, rot: 0, title: 'FOR COLLECTION', label: 'Read the sheet', html: listHtml() });
    desk(w, { x: 0, z: -43.2, rot: 0, papers: false });
    // the cold-lock console
    let lockUntil = 0; const tagsGot = new Set(); let tagsDone = false;
    const relCon = consoleProp(w, { x: -4, z: -54.35, rot: 0, title: 'COLD LOCK', draw: (ctx) => {
      screenText(ctx, 320, 200, ['COLD LOCK', c.get('c6:rel:' + other, false) || c.get('c6:rel:' + me, false) ? 'RELEASED' : 'ENGAGED', 'TAGS ' + tagsGot.size + '/3', w.t < lockUntil ? 'RESET ' + Math.ceil(lockUntil - w.t) + 's' : 'READY'], { size: 26, color: w.t < lockUntil ? '#ff6a4a' : '#7dffb8' });
    } });
    let relWas = false;
    const relHold = holdable(w, game, hud, { x: -4, y: 1.2, z: -53.7, w: 1.3, h: 1.6, d: 0.4, range: 3.4, noBar: true, label: (s) => (s.held ? 'Holding the cold lock open' : 'Hold the cold lock open (your partner pulls)'), tick: (dt, s) => { s.k = s.held ? 1 : 0; if (s.held !== relWas) { relWas = s.held; c.set('c6:rel:' + me, s.held); } } });
    let screenT = 0; w.updaters.push((dt) => { screenT -= dt; if (screenT <= 0) { screenT = 0.3; relCon.refresh(); } });
    void relHold;
    const coldDoor = door(w, { x: 5, z: COLD_N, along: 'x', width: 2.0, key: 'cold', locked: true, label: 'cold-room door', game });
    for (const d of Object.values(DR)) {
      const tgt = TARGETS.includes(d.id), bank = d.world.x < 0 ? wBank : eBank;
      const o = d.out, bx = Math.abs(o.x) > 0.5;
      press({ x: d.world.x + o.x * 0.3, y: BOT && tgt ? 1.2 : d.world.y, z: d.world.z + o.z * 0.3, bw: bx ? 0.5 : 1.0, bh: BOT && tgt ? 2.6 : d.rowH * 0.9, bd: bx ? 1.0 : 0.5, range: 3.2,
        label: () => `Drawer ${d.id}`, enabled: () => !d.state && (!BOT || tgt),
        onUse: () => {
          if (w.t < lockUntil) { sayMeCd('lt.c6.cold.reset'); return; }
          if (!c.get('c6:rel:' + other, false)) { sayMeCd('lt.c6.cold.hold'); return; }
          c.emit('c6:pull', { id: d.id, by: me, ok: TARGETS.includes(d.id) });
        } });
      void bank;
    }
    const lockAfter = (sec) => { lockUntil = w.t + sec; };
    c.onEvent('c6:pull', (a) => {
      const d = DR[a.id]; if (!d || d.state) return;
      const px = d.world.x + d.out.x, pz = d.world.z + d.out.z;
      if (a.ok) {
        d.state = 'ok'; d.rate = 1.6; d.want = 1; S.scrape(pan(px, pz), 0.12); tagsGot.add(a.id); relCon.refresh();
        w.after(1.2, () => { S.bell(pan(px, pz), 0.12); if (a.by === me) toast(`Toe tag taken: ${a.id}`); });
        sayAll(tagsGot.size === 3 ? 'lt.c6.cold.tags3' : 'lt.c6.cold.right', { priority: 2 });
        if (tagsGot.size === 3 && !tagsDone) { tagsDone = true; w.after(1.8, () => { S.door(0, 0.3); coldDoor.unlock(); coldDoor.setOpen(true); }); }
      } else {
        d.state = 'wrong'; d.rate = 2.4; d.want = 1; S.scrape(pan(px, pz), 0.14); lockAfter(11);
        w.after(0.8, () => { d.sitWant = 1; S.groan(0.2); H.stutter(1.4); sayAll('lt.c6.cold.wrong', { priority: 2 }); });
        w.after(2.9, () => { d.rate = 6; d.want = 0; d.sitWant = 0; d.sit = 0; S.slam(0.4); Z.knock({ role: 'all', n: 3 }); });
        w.after(3.6, () => { d.state = null; });
      }
    });
    trip('cold', { x: 0, y: 1, z: -37, w: 8, h: 3, d: 2.5 }, () => {
      sayAll('lt.c6.cold', { priority: 2 }); w.after(7, () => R.whisper({ keyholder: 'lt.c6.whisper.k2', subject: 'lt.c6.whisper.s2' }));
      w.after(20, () => { if (!tagsDone) sayAll('lt.c6.cold.hint'); });
    });
    checkpoint(w, { x: 0, z: -37, side: 1.5 });

    // ============================================================ 4 · THE VIEWING HALL — ROUND 1 ================================
    room(w, { x: 0, z: -66, w: 20, d: 22, sides: { s: false, n: false }, ...tiled });
    stencil(w, 'VIEWING HALL', { x: 5, y: 2.9, z: -55.17, rot: 0, width: 3.4, size: 0.38 });
    [[-62, 'dead', -6], [-66, 'dying', 6], [-72, 'buzz', 0], [-74, 'dead', 7]].forEach(([z, m, x]) => lamp({ x, y: 3.35, z, mode: m, len: 1.3 }));
    for (const [pz, sx] of [[-64, -1], [-66, -1], [-68, -1], [-64, 1], [-66, 1], [-68, 1]]) locker(w, { x: sx * 9.55, z: pz, rot: sx * PI / 2, ajar: pz === -66 ? 0.7 : 0 });
    hideSpot({ x: -9, z: -66, w: 2.4, d: 6.6 }); hideSpot({ x: 9, z: -66, w: 2.4, d: 6.6 });
    plinth(w, { x: -3.5, z: -70, label: 'A' }); plinth(w, { x: 3.5, z: -70, label: 'B' });
    pipes(w, { x0: -9.4, z0: -56, x1: 9.4, z1: -56, y: 3.0, n: 2 });
    barWindow(w, { x: -9.82, y: 1.9, z: -72, rot: PI / 2 }); barWindow(w, { x: 9.82, y: 1.9, z: -72, rot: -PI / 2 });
    decal(w, { kind: 'puddle', seed: 8, x: 0, y: 0.025, z: -62, w: 3.6, h: 3.6 }); decal(w, { kind: 'drag', seed: 2, x: 0, y: 0.02, z: -74, w: 3.4, h: 2.2, face: 'floor', rot: 1.57 }); decal(w, { kind: 'hand', seed: 12, x: -9.84, y: 1.0, z: -60, w: 0.5, h: 0.5, face: 'e' });
    const hallDoor = door(w, { x: 0, z: -77, along: 'x', width: 2.4, key: 'hall', locked: true, label: 'hall door', game });
    // your lectern: cycle through the words, and say yours
    let r1On = false; const say = { p1: -1, p2: -1 };
    for (const r of ['p1', 'p2']) c.on('c6:say:' + r, (v) => { say[r] = v | 0; });
    const lect = consoleProp(w, { x: me === 'p1' ? -8 : 8, z: -59, rot: 0, title: 'SPEAK', draw: (ctx) => {
      screenText(ctx, 320, 200, ['SAY YOUR WORD', say[me] >= 0 ? WORDS[say[me]] : '- - - -', 'press E: next'], { size: 28, color: '#ffd36a' });
    } });
    press({ x: me === 'p1' ? -8 : 8, y: 1.2, z: -58.2, bw: 1.3, bh: 1.6, bd: 0.4, range: 3.4, label: () => `Say a word (${say[me] >= 0 ? WORDS[say[me]] : '----'})`, enabled: () => r1On && !r1Done,
      onUse: () => { c.set('c6:say:' + me, (say[me] + 1 + 6) % 6); lect.refresh(); S.squeak(0, 0.05); game.audio.confirm?.(); } });
    c.on('c6:say:' + me, () => lect.refresh());
    let r1Done = false;
    const realIdx = c.rng(40 + (me === 'p1' ? 1 : 2))() < 0.5 ? 0 : 1;
    const pPos = [{ x: -3.5, z: -70 }, { x: 3.5, z: -70 }];
    const puppets = pPos.map((pp, i) => {
      const clone = game.coop.avatar.clone(true); clone.visible = false; w.scene.add(clone); clone.position.set(pp.x, 0.26, pp.z); clone.rotation.y = PI;
      const st = speechTag(clone, { y: 2.9 }); st.set('....');
      const dd = makeDouble(10 + i); dd.mode = 'off';
      return { clone, st, pp, i, D: dd, tag: tagOf(clone) };
    });
    const decoyWord = () => ((agreed >= 0 ? agreed : 0) + 2 + Math.floor(hash(me === 'p1' ? 3 : 5) * 3)) % 6;
    puppets.forEach((p) => {
      press({ x: p.pp.x, y: 1.3, z: p.pp.z + 0.75, bw: 1.0, bh: 2.2, bd: 0.7, range: 3.6, label: () => 'Take their hand', enabled: () => r1On && !r1Done && !charge.D,
        onUse: () => {
          const ok = p.i === realIdx; recordPick('r1', ok);
          if (ok) {
            r1Done = true; c.set('c6:r1:' + me, true); S.bell(0, 0.16); sayMe('lt.c6.r1.right');
          } else { p.D.x = p.pp.x; p.D.z = p.pp.z; startCharge(p.D); }
        } });
    });
    c.on('c6:r1:' + other, () => { if (c.get('c6:r1:p1') && c.get('c6:r1:p2') && hallDoor.locked) { hallDoor.unlock(); hallDoor.setOpen(true); sayAll('lt.c6.r1.done', { priority: 2 }); S.door(0, 0.3); } });
    c.on('c6:r1:' + me, () => { if (c.get('c6:r1:p1') && c.get('c6:r1:p2') && hallDoor.locked) { hallDoor.unlock(); hallDoor.setOpen(true); sayAll('lt.c6.r1.done', { priority: 2 }); S.door(0, 0.3); } });
    w.updaters.push(() => {
      for (const p of puppets) {
        p.clone.visible = r1On && charge.D !== p.D;
        if (!r1On) continue;
        const real = p.i === realIdx, sw = real ? say[other] : decoyWord();
        p.st.set(sw >= 0 ? WORDS[sw] : '. . . .', real ? '#cfe8dc' : '#cfe8dc');
        p.clone.rotation.y = PI + (real && c.partner.has ? Math.max(-0.5, Math.min(0.5, angDiff(0, -(c.partner.yaw || 0)) * 0.25)) : 0);
        const d = Math.hypot(p.pp.x - game.player.x, p.pp.z - game.player.z);
        if (p.tag) { p.tag.visible = d > 1.2; p.tag.position.y = 2.15; p.tag.scale.setScalar(1.2); }
        p.D.x = p.pp.x; p.D.z = p.pp.z;
      }
      if (r1On && !r1Done) { if (game.coop.avatar) game.coop.avatar.visible = false; H.theirOn = false; } else if (H.theirOn === false && !hallHide) H.theirOn = undefined;
    });
    let hallHide = false;
    c.onEvent('c6:r1-end', () => { hallHide = false; H.theirOn = undefined; });
    trip('hall', { x: 0, y: 1, z: -58, w: 18, h: 3, d: 3 }, () => {
      r1On = true; hallHide = true; sayAll('lt.c6.r1.intro', { priority: 2 }); lect.refresh();
      w.after(9, () => sayAll('lt.c6.r1.hint'));
      w.after(24, () => R.whisper({ keyholder: 'lt.c6.whisper.k3', subject: 'lt.c6.whisper.s3' }));
    });
    c.on('c6:r1:' + me, () => { w.after(0.1, () => { r1On = false; }); });
    checkpoint(w, { x: 0, z: -57.5, side: 1.4 });

    // ============================================================ 5 · THE AUTOPSY SUITE =========================================
    const AU = { x0: -13, x1: 13, zS: -77, zN: -99 };
    room(w, { x: 0, z: -88, w: 26, d: 22, doors: { n: [{ c: 0, w: 2.4 }], s: [{ c: 0, w: 2.4 }] }, ...tiled });
    stencil(w, 'AUTOPSY', { x: -6, y: 2.9, z: -77.17, rot: 0, width: 3, size: 0.4 });
    [[-82, 'buzz', -6], [-82, 'dying', 6], [-88, 'dead', 0], [-94, 'dying', -7], [-94, 'dead', 7], [-97, 'buzz', 0]].forEach(([z, m, x]) => lamp({ x, y: 3.35, z, mode: m, len: 1.3 }));
    const tables = [[-5, -84], [5, -84], [-5, -93], [5, -93]].map(([x, z]) => slabTable(w, { x, z, rot: 0 }));
    box(w, { x: 0, y: 0.02, z: -88.5, w: 1.4, h: 0.04, d: 16, kind: 'rust', color: 0x2c3431, shadow: false });
    decal(w, { kind: 'puddle', seed: 17, x: 0, y: 0.03, z: -88.5, w: 3, h: 4 }); decal(w, { kind: 'drag', seed: 31, x: 2, y: 0.02, z: -80, w: 3, h: 2.6, face: 'floor', rot: 0.4 }); decal(w, { kind: 'splat', seed: 23, x: -2, y: 0.02, z: -95, w: 2.6, h: 2.6 });
    decal(w, { kind: 'hand', seed: 7, x: -12.84, y: 1.2, z: -82, w: 0.5, h: 0.5, face: 'e' }); decal(w, { kind: 'scratch', seed: 4, x: 12.84, y: 1.5, z: -93, w: 1.6, h: 1.6, face: 'w' });
    pipes(w, { x0: -12.5, z0: -78, x1: 12.5, z1: -78, y: 3.0, n: 3 }); pipes(w, { x0: -12.5, z0: -98, x1: 12.5, z1: -98, y: 3.0, n: 3 });
    const auBank = drawerBank(w, { x: -6.5, z: -98.1, rot: 0, cols: 5, id: (r, k) => `N${r}${k}` });
    const auBank2 = drawerBank(w, { x: 6.5, z: -98.1, rot: 0, cols: 5, id: (r, k) => `M${r}${k}` });
    // the two slab-release consoles, each in an alcove between lockers
    const slabs = [{ x: -12.35, rot: PI / 2, ix: -11.65, hx: -11.5 }, { x: 12.35, rot: -PI / 2, ix: 11.65, hx: 11.5 }];
    let slabK = 0, slabDone = false;
    const slabSt = slabs.map((s, i) => {
      locker(w, { x: s.x + (i ? 0.05 : -0.05), z: -85.4, rot: s.rot }); locker(w, { x: s.x + (i ? 0.05 : -0.05), z: -90.6, rot: s.rot });
      hideSpot({ x: s.hx + (i ? 0.5 : -0.5), z: -88, w: 3, d: 5.2 });
      const con = consoleProp(w, { x: s.x, z: -88, rot: s.rot, title: 'SLAB RELEASE', draw: (ctx) => { screenText(ctx, 320, 200, ['SLAB RELEASE', slabDone ? 'RELEASED' : 'HOLD BOTH', Math.round(slabK * 100) + '%', 'TORCH [F]'], { size: 26, color: slabDone ? '#6dffb4' : '#ffd36a' }); } });
      const st = holdable(w, game, hud, { x: s.ix, y: 1.2, z: -88, w: 0.5, h: 1.6, d: 1.4, range: 3.2, bar: 'HOLD THE RELEASE', enabled: () => auOn && !slabDone, label: (q) => (q.held ? 'Holding the release...' : 'Hold the slab release'), tick: () => {} });
      return { con, st };
    });
    let auOn = false;
    w.updaters.push((dt) => {
      if (!auOn || slabDone) return;
      c.set('c6:slab:' + me, slabSt[0].st.held ? 0 : slabSt[1].st.held ? 1 : -1);
      const a = c.get('c6:slab:p1', -1), b = c.get('c6:slab:p2', -1);
      const both = a >= 0 && b >= 0 && a !== b;
      slabK = both ? Math.min(1, slabK + dt / 7) : Math.max(0, slabK - dt * 0.3);
      for (const s of slabSt) s.st.k = slabK;
      if (slabK >= 1) { slabDone = true; c.emit('c6:slabdone'); }
    });
    let conT = 0; w.updaters.push((dt) => { conT -= dt; if (conT <= 0) { conT = 0.25; for (const s of slabSt) s.con.refresh(); } });
    const auDoor = door(w, { x: 0, z: -99, along: 'x', width: 2.4, key: 'au', locked: true, label: 'suite door', game });
    c.onEvent('c6:slabdone', () => {
      slabDone = true; sayAll('lt.c6.au.done', { priority: 2 }); S.groan(0.25); H.stutter(2);
      tables.forEach((t, i) => w.after(1 + i * 1.4, () => { let k = 0; const id = setInterval(() => { k += 0.07; t.body.pivot.rotation.x = -Math.min(1, k) * 1.25; if (k >= 1) clearInterval(id); }, 30); S.scrape(pan(t.group.position.x, t.group.position.z), 0.14); }));
      w.after(7, () => { auDoor.unlock(); auDoor.setOpen(true); Z.knock({ role: 'all', n: 4 }); });
    });
    // the Orderly
    const N = (id, x, z) => ({ id, x, z });
    const st = stalker(w, game, H, S, {
      nodes: [N('a', 0, -81.5), N('b', 8.8, -81.5), N('c', 8.8, -95.5), N('d', 0, -95.5), N('e', -8.8, -95.5), N('f', -8.8, -81.5), N('m', 0, -88.5)],
      route: ['a', 'b', 'm', 'c', 'd', 'e', 'm', 'f'], start: 'c', speed: 1.7, pause: 2.2, link: 20,
    });
    st.home = 'c'; st.setActive(false);
    const tr = trolley(w, { x: -9.5, z: -97 });
    w.updaters.push((dt) => tr.update(dt));
    let trayCd = 0; w.updaters.push((dt) => { trayCd = Math.max(0, trayCd - dt); });
    press({ x: -9.5, y: 1.1, z: -96.2, bw: 1.2, bh: 1.4, bd: 0.8, label: () => (trayCd > 0 || tr.fallen ? 'The tray is down' : 'Knock the tray off'), enabled: () => auOn && !tr.fallen && trayCd <= 0,
      onUse: () => { trayCd = 25; c.emit('c6:tray', { by: me }); } });
    c.onEvent('c6:tray', (a) => { tr.tip(); S.slam(0.4); S.scrape(pan(-9.5, -97), 0.1); if (a.by === me) st.noise(-9.5, -97, 22); });
    trip('au', { x: 0, y: 1, z: -79.3, w: 5, h: 3, d: 2 }, () => {
      auOn = true; sayAll('lt.c6.au.intro', { priority: 2 }); w.after(3, () => toast('F switches your torch on and off. A lit torch gives you away.'));
      if (c.isHost) { st.setActive(true); st.warp(8.8, -95.5); st.setRoute(['c', 'd', 'e', 'm', 'f', 'a', 'b', 'm']); st.state = 'patrol'; }
      w.after(10, () => sayAll('lt.c6.au.hint'));
      w.after(30, () => R.whisper({ keyholder: 'lt.c6.whisper.k4', subject: 'lt.c6.whisper.s4' }));
    });
    c.onEvent('c6:slabdone', () => { if (c.isHost) w.after(2, () => st.setActive(false)); });
    checkpoint(w, { x: 3, z: -78.8, side: 1 });

    // ============================================================ 6 · THE CHAPEL — ROUND 2 ======================================
    room(w, { x: 0, z: -110, w: 22, d: 22, h: 5, sides: { s: false, n: false }, ...tiled });
    stencil(w, 'CHAPEL OF REST', { x: 5.5, y: 3.6, z: -99.17, rot: 0, width: 4, size: 0.36 });
    [[-104, 'dead', -6], [-108, 'dying', 6], [-114, 'buzz', 0], [-118, 'dead', 6]].forEach(([z, m, x]) => lamp({ x, y: 4.85, z, mode: m, len: 1.3 }));
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) pew(w, { x: sx * 6.2, z: -103.5 - i * 2.2, len: 4.4 });
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) locker(w, { x: sx * 10.55, z: -104 - i * 0.7, rot: -sx * PI / 2 });
    hideSpot({ x: -10, z: -104.4, w: 2.2, d: 2.6 }); hideSpot({ x: 10, z: -104.4, w: 2.2, d: 2.6 });
    box(w, { x: 0, y: 0.6, z: -118.6, w: 2.2, h: 1.2, d: 1.0, kind: 'concrete', color: 0x6a746f }); w.collider({ x: 0, y: 0.6, z: -118.6, w: 2.2, h: 1.2, d: 1.0 });
    for (const [cx, cz] of [[-0.8, -118.6], [0, -118.6], [0.8, -118.6], [-1.6, -118.2], [1.6, -118.2]]) candle(w, { x: cx, y: 1.2, z: cz });
    candle(w, { x: -4.4, y: 0.5, z: -113 }); candle(w, { x: 4.5, y: 0.5, z: -114.2 }); candle(w, { x: -9.6, y: 0.5, z: -112 });
    lamp({ x: 0, y: 4.2, z: -117.6, mode: 'dying', power: 0.45, len: 0.5, color: 0xffc080 });
    barWindow(w, { x: -10.82, y: 2.4, z: -115, rot: PI / 2, width: 1.8, height: 2.2 }); barWindow(w, { x: 10.82, y: 2.4, z: -115, rot: -PI / 2, width: 1.8, height: 2.2 });
    decal(w, { kind: 'puddle', seed: 19, x: 0, y: 0.025, z: -108, w: 4, h: 4 }); decal(w, { kind: 'drag', seed: 9, x: 0, y: 0.02, z: -114, w: 4, h: 2.4, face: 'floor', rot: 1.57 }); decal(w, { kind: 'hand', seed: 21, x: -10.84, y: 1.2, z: -108, w: 0.5, h: 0.5, face: 'e' });
    pipes(w, { x0: -10.5, z0: -100, x1: -10.5, z1: -120, y: 4.4, n: 2 });
    const chapDoor = door(w, { x: 0, z: -121, along: 'x', width: 2.4, key: 'chap', locked: true, label: 'garden door', game });

    // ---- the handshake round (used twice) ------------------------------------------------------------------------------
    const makeParade = ({ id, cons, doublesUsed, onWin, labels = 'AB' }) => {
      const P = { id, on: false, done: false, last: {}, cons: [], doubles: doublesUsed };
      cons.forEach((cn, k) => {
        const hc = handConsole(w, { x: cn.x, z: cn.z, label: labels[k] });
        P.cons.push({ hc, k, x: cn.x, z: cn.z });
        for (const side of ['s', 'n']) {
          const pad = hc.pads[side];
          let cool = 0;
          press({ x: pad.x, y: 1.2, z: pad.z + pad.sz * 0.05, bw: 0.8, bh: 1.6, bd: 0.4, range: 3.0, label: () => (P.done ? 'Clasped' : 'Press your palm'), enabled: () => P.on && !P.done && !charge.D,
            onUse: () => {
              if (w.t < cool) return; cool = w.t + 0.6; w.c6?.log.push(`${id} press k${k} ${side} t${w.t.toFixed(1)}`);
              const Pp = c.partner, real = Pp.has && !Pp.dead && Math.hypot(Pp.sx - cn.x, Pp.sz - cn.z) < 2.7;
              const dbl = P.doubles.find((D) => D.vis && Math.hypot(D.x - cn.x, D.z - cn.z) < 2.7);
              if (!real && dbl) { recordPick(id, false); hc.set('bad'); w.after(1.2, () => hc.set('idle')); startCharge(dbl); return; }
              if (!real) { sayMeCd('lt.c6.nohand'); hc.set('wait'); w.after(1.6, () => { if (!P.done) hc.set('idle'); }); return; }
              recordPick(id, true);
              c.emit('c6:hs:' + id, { by: me, k, side, t: w.t });
            } });
        }
      });
      c.onEvent('c6:hs:' + id, (a) => {
        if (P.done) return;
        P.last[a.by] = a; const o = P.last[a.by === 'p1' ? 'p2' : 'p1'];
        const hc = P.cons[a.k].hc;
        if (o && o.k === a.k && o.side !== a.side && Math.abs(o.t - a.t) < 1.5) {
          P.done = true; hc.set('ok'); S.bell(0, 0.2); S.groan(0.12); onWin(a.k);
        } else { hc.set('wait'); w.after(1.6, () => { if (!P.done) hc.set('idle'); }); }
      });
      return P;
    };
    const par2 = makeParade({ id: 'r2', cons: [{ x: -4.5, z: -112.5 }, { x: 4.5, z: -112.5 }], doublesUsed: [D1], onWin: () => {
      D1.mode = 'off'; sayAll('lt.c6.r2.done', { priority: 2 }); finishTrustSoon(); w.after(2.2, () => { chapDoor.unlock(); chapDoor.setOpen(true); S.door(0, 0.3); });
    } });
    const finishTrustSoon = () => { /* trust is finalised at the very end */ };
    trip('chap', { x: 0, y: 1, z: -101, w: 20, h: 3, d: 2 }, () => {
      sayAll('lt.c6.chap', { priority: 2 });
      w.after(5, () => { S.whisper(0.05, 2.0, 0.18); R.whisper({ keyholder: 'lt.c6.whisper.k5', subject: 'lt.c6.whisper.s5' }); });
      w.after(11, () => { Z.behind('patient', { role: 'all', dist: 3.4, dur: 10 }); });
    });
    trip('r2', { x: 0, y: 1, z: -107, w: 20, h: 3, d: 2 }, () => {
      par2.on = true; D1.mode = 'mirror'; D1.lag = 1.1; D1.axis = 0; D1.dz = 0; D1.torch = true; D1.fixed = null;
      sayAll('lt.c6.r2.intro', { priority: 2 }); w.after(12, () => sayAll('lt.c6.r2.hint'));
    });
    checkpoint(w, { x: 0, z: -101.2, side: 1.5 });

    // ============================================================ 7 · THE GARDEN ===============================================
    const CZ0 = -121, CZ1 = -168;
    const GR = 16;
    const rain = rainField(w, game, { count: game.lowGfx ? 350 : 700 });
    // the ground and the walls
    floor(w, { x: 0, z: (CZ0 + CZ1) / 2, w: 2 * GR, d: CZ0 - CZ1, kind: 'concrete', color: 0x3a5040 });
    const longWall = (x, z, len, along) => wall(w, { x, z, w: along === 'x' ? len : 0.3, d: along === 'x' ? 0.3 : len, kind: 'concrete', h: 3.4 });
    longWall(-GR, (CZ0 + CZ1) / 2, CZ0 - CZ1, 'z'); longWall(GR, (CZ0 + CZ1) / 2, CZ0 - CZ1, 'z'); longWall(0, CZ1, 2 * GR + 0.3, 'x');
    const wallGap = (z, half) => { longWall(-GR / 2 - half / 2, z, GR - half, 'x'); longWall(GR / 2 + half / 2, z, GR - half, 'x'); box(w, { x: 0, y: 2.95, z, w: half * 2, h: 0.9, d: 0.3, kind: 'concrete', color: 0x555d58 }); };
    wallGap(CZ0, 1.2);                                                          // the south wall with the chapel door
    wallGap(-150, 1.6); wallGap(-162, 1.6);
    box(w, { x: 0, y: 0.03, z: -139, w: 3, h: 0.06, d: 36, kind: 'tile', color: 0x6a7770, rough: 0.9, shadow: false });      // the path
    stencil(w, 'ST. ANNE · GARDEN OF REST', { x: -6, y: 2.3, z: CZ0 - 0.17, rot: PI, width: 5, size: 0.3 });
    // fountain, benches, hedges, graves
    box(w, { x: 0, y: 0.35, z: -131, w: 3.2, h: 0.7, d: 3.2, kind: 'concrete', color: 0x6a746f }); w.collider({ x: 0, y: 0.5, z: -131, w: 3.2, h: 1.0, d: 3.2 });
    box(w, { x: 0, y: 0.8, z: -131, w: 0.5, h: 1.2, d: 0.5, kind: 'concrete', color: 0x5a645f }); decal(w, { kind: 'puddle', seed: 31, x: 0, y: 0.72, z: -131, w: 2.6, h: 2.6 });
    for (const sx of [-1, 1]) { bench(w, { x: sx * 5.2, z: -127, rot: sx * PI / 2, len: 2.2 }); hedge(w, { x: sx * 6.8, z: -137, len: 12, along: 'z' }); hedge(w, { x: sx * 11, z: -127, len: 7, along: 'x', thick: 1.0 }); }
    for (const sx of [-1, 1]) { hedge(w, { x: sx * 12.5, z: -135, len: 4, along: 'x', thick: 1 }); hedge(w, { x: sx * 14.6, z: -139, len: 7, along: 'z', thick: 1 }); hedge(w, { x: sx * 12.5, z: -143, len: 4, along: 'x', thick: 1 }); hideSpot({ x: sx * 12.5, z: -139, w: 3.4, d: 7 }); }
    const n1 = esc(c.names[me]).slice(0, 14), n2 = esc(c.names[other]).slice(0, 14);
    grave(w, { x: -11.5, z: -124.6, rot: 0, text: [n1.toUpperCase(), '1971 - TONIGHT'] }); grave(w, { x: -9.4, z: -124.9, rot: 0.1, text: [n2.toUpperCase(), '1974 - TONIGHT'], lean: 0.06 });
    grave(w, { x: 9, z: -125, rot: -0.12, text: ['NOT YET', ''], lean: -0.05 }); grave(w, { x: 11.5, z: -124.6, rot: 0.05, text: ['ANNE L.', 'KEEP THE LIGHT'], h: 1.3 });
    for (let i = 0; i < 6; i++) grave(w, { x: (i % 2 ? 1 : -1) * (9 + (i % 3)), z: -146 - (i % 3) * 1.6 - Math.floor(i / 2) * 0.1, rot: (hash(i) - 0.5) * 0.4, lean: (hash(i + 9) - 0.5) * 0.14, h: 0.8 + hash(i + 2) * 0.5 });
    for (const [lx, lz, m] of [[-4.6, -125, 'dying'], [4.6, -125, 'dead'], [-4.6, -141, 'buzz'], [4.6, -141, 'dying'], [-9.5, -154, 'dying'], [9.5, -154, 'buzz']]) lampPost(w, H, { x: lx, z: lz, mode: m, power: 0.8 });
    decal(w, { kind: 'puddle', seed: 40, x: -3, y: 0.025, z: -134, w: 3.4, h: 3.4 }); decal(w, { kind: 'puddle', seed: 41, x: 4, y: 0.025, z: -146, w: 3.6, h: 3.0 }); decal(w, { kind: 'drag', seed: 44, x: 0, y: 0.04, z: -126, w: 3, h: 2.4, face: 'floor', rot: 1.57 });
    // the weeping angels
    const A1 = angel(w, { x: -9, z: -138, yaw: PI / 2 }), A2 = angel(w, { x: 9, z: -144, yaw: -PI / 2 });
    const angelList = [A1, A2];
    angelList.forEach((a) => { a.lit = 0; });
    const lit = [0, 0]; let statuesDone = false, statueK = 0;
    const fwdV = new THREE.Vector3();
    w.updaters.push((dt) => {
      if (!gardenOn || statuesDone) return;
      const g = game.player, cp = Math.cos(game.pitch);
      fwdV.set(-Math.sin(game.yaw) * cp, Math.sin(game.pitch), -Math.cos(game.yaw) * cp);
      let mine = -1;
      if (H.torchOn) angelList.forEach((a, i) => {
        const dx = a.head.x - g.x, dy = a.head.y - (g.y + 1.62), dz = a.head.z - g.z, d = Math.hypot(dx, dy, dz);
        if (d < 15 && (dx * fwdV.x + dy * fwdV.y + dz * fwdV.z) / d > Math.cos(0.25)) mine = i;
      });
      c.set('c6:lit:' + me, mine);
      const l1 = c.get('c6:lit:p1', -1), l2 = c.get('c6:lit:p2', -1);
      lit[0] = l1 === 0 || l2 === 0 ? 1 : 0; lit[1] = l1 === 1 || l2 === 1 ? 1 : 0;
      statueK = lit[0] && lit[1] ? Math.min(1, statueK + dt / 3) : Math.max(0, statueK - dt * 0.7);
      angelList.forEach((a, i) => { a.lit += (lit[i] * (0.4 + 0.6 * statueK) - a.lit) * Math.min(1, dt * 5); a.eyes(a.lit); });
      if (statueK >= 1) { statuesDone = true; c.emit('c6:statues'); }
    });
    w.updaters.push(() => {                                                        // an angel turns its head to you the moment nobody is looking
      for (const a of angelList) {
        if (!gardenOn) break;
        const cam = game.camera.position, dx = cam.x - a.x, dz = cam.z - a.z, dd = Math.hypot(dx, dz) || 1;
        const s = seenBy(a.x, a.z), toward = Math.atan2(dx, dz) - a.F.group.rotation.y;
        a.F.head.rotation.y = dd < 22 && !s.seen ? Math.max(-1.1, Math.min(1.1, angDiff(0, toward))) : a.F.head.rotation.y * 0.96;
      }
    });
    const gate = door(w, { x: 0, z: -150, along: 'x', width: 3.2, key: 'gg', locked: true, label: 'garden gate', game });
    c.onEvent('c6:statues', () => { statuesDone = true; for (const a of angelList) a.eyes(1.4); sayAll('lt.c6.court.done', { priority: 2 }); S.door(0, 0.3); S.groan(0.2); w.after(1.5, () => { gate.unlock(); gate.setOpen(true); }); });
    let gardenOn = false;
    c.onEvent('c6:chapgo', () => {});
    trip('garden', { x: 0, y: 1, z: -124.5, w: 6, h: 3, d: 2 }, () => {
      gardenOn = true; sayAll('lt.c6.court', { priority: 2 });
      w.after(9, () => sayAll('lt.c6.court.hint')); w.after(20, () => { S.whisper(0.02, 2, 0.18); R.whisper({ keyholder: 'lt.c6.whisper.k6', subject: 'lt.c6.whisper.s6' }); });
      w.after(30, () => { Z.behind('patient', { role: 'all', dist: 3.6, dur: 9 }); });
    });
    trip('garden-mid', { x: 0, y: 1, z: -137, w: 14, h: 3, d: 2 }, () => { Z.stand('patient', -13.2, -148, { role: 'all', dur: 24 }); });
    checkpoint(w, { x: 0, z: -123.5, side: 1.5 });
    const rainSnd = () => {
      const A = game.audio; if (!A.ctx || !A.noiseBuf || rainSnd.s) return;
      const s = A.ctx.createBufferSource(); s.buffer = A.noiseBuf; s.loop = true; const fl = A.ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 1400; const g = A.ctx.createGain(); g.gain.value = 0;
      s.connect(fl); fl.connect(g); g.connect(A.master); s.start(); rainSnd.s = { s, g };
    };
    w.disposers.push(() => { try { rainSnd.s?.s.stop(); } catch { /* ignore */ } });
    const hemi0 = w.hemi.intensity;
    w.updaters.push((dt) => {
      const z = game.player.z, k = Math.max(0, Math.min(1, (CZ0 - 1.5 - z) / 3));
      rain.k += (k - rain.k) * Math.min(1, dt * 2);
      w.hemi.intensity = hemi0 + 0.3 * rain.k;
      if (k > 0.1) rainSnd(); if (rainSnd.s) rainSnd.s.g.gain.setTargetAtTime(0.05 * k, game.audio.ctx.currentTime, 0.3);
    });

    // ============================================================ 8 · THE LYCH-GATE — ROUND 3 ===================================
    stencil(w, 'LYCH-GATE', { x: 5, y: 2.9, z: -150.17, rot: 0, width: 3.2, size: 0.38 });
    const par3 = makeParade({ id: 'r3', cons: [{ x: -6, z: -156 }, { x: 0, z: -156 }, { x: 6, z: -156 }], doublesUsed: [D1, D2], labels: 'ABC', onWin: () => {
      D1.mode = 'off'; D2.mode = 'off'; sayAll('lt.c6.r3.done', { priority: 2 }); finishTrust();
      w.after(2.4, () => { lych.unlock(); lych.setOpen(true); S.door(0, 0.3); });
    } });
    const lych = door(w, { x: 0, z: -162, along: 'x', width: 3.2, key: 'lych', locked: true, label: 'lych-gate', game });
    for (const [x, m] of [[-4, 'dying'], [4, 'dead']]) lampPost(w, H, { x, z: -165, mode: m, power: 0.7 });
    hedge(w, { x: -12, z: -157, len: 5, along: 'x', thick: 1 }); hedge(w, { x: -14.2, z: -154, len: 6, along: 'z', thick: 1 }); hideSpot({ x: -12.5, z: -154.4, w: 3.4, d: 5 });
    hedge(w, { x: 12, z: -157, len: 5, along: 'x', thick: 1 }); hedge(w, { x: 14.2, z: -154, len: 6, along: 'z', thick: 1 }); hideSpot({ x: 12.5, z: -154.4, w: 3.4, d: 5 });
    for (let i = 0; i < 4; i++) grave(w, { x: (i % 2 ? 1 : -1) * (9 + i), z: -164 - 0, rot: (hash(i + 20) - 0.5) * 0.3, h: 0.9, lean: 0.05 });
    decal(w, { kind: 'puddle', seed: 52, x: 0, y: 0.025, z: -153, w: 5, h: 3 });
    trip('r3', { x: 0, y: 1, z: -151.5, w: 6, h: 3, d: 1.6 }, () => {
      par3.on = true;
      D1.mode = 'mirror'; D1.lag = 1.0; D1.axis = 0; D1.dz = 0; D1.torch = true; D1.fixed = null;
      D2.mode = 'follow'; D2.lag = 2.3; D2.off = 6; D2.torch = true; D2.fixed = null;
      sayAll('lt.c6.r3.intro', { priority: 2 }); w.after(10, () => sayAll('lt.c6.r3.hint')); w.after(26, () => sayAll('lt.c6.r3.hint2'));
    });
    exitDoor(w, { x: 0, z: -167.6, rot: 0 });
    trip('exit', { x: 0, y: 1, z: -164.5, w: 5, h: 3, d: 1.4 }, () => { sayAll('lt.c6.exit', { priority: 2 }); });
    // remember: the final trust flag is also written when the chapter completes
    w.hooks.onComplete = ((prev) => () => { prev?.(); finishTrust(); })(w.hooks.onComplete);

    // ============================================================ bots ==========================================================
    const near = (px, pz, r) => { const g = game.player; return Math.hypot(g.x - px, g.z - pz) < r; };
    const pn = (px, pz, r) => { const P = c.partner; return P.has && Math.hypot(P.sx - px, P.sz - pz) < r; };
    const wordSteps = [0, 1].map((i) => ({ x: -7.0, z: cellZ(i) - 0.0, r: 0.5 }));                      // placeholder to keep indices tidy
    void wordSteps;
    const bookStand = (i) => ({ x: -5.4, z: cellZ(i), r: 0.6 });
    const pickWord = (idx) => [bookStand(idx), { x: -7.3, z: cellZ(idx), r: 1.7, use: true, until: () => wordPick[me] === idx }];
    const common0 = [
      ...pickWord(0),
      { x: 0, z: -4, r: 1.0, until: () => agreed >= 0 },
    ];
    const fuseStep = (i) => [{ x: i ? 5.2 : -5.2, z: -5.5, r: 0.6 }, { x: i ? 7.1 : -7.1, z: -5.5, r: 1.5, use: true, until: () => power }];
    const reach = (x, z, r = 0.9) => ({ x, z, r });
    const cold = {
      holder: [reach(-4, -52, 0.8), { x: -4, z: -53.7, r: 1.5, use: true, until: () => tagsDone }],
      puller: TARGETS.flatMap((id) => { const d = DR[id], px = d.world.x + d.out.x * 1.7, pz = d.world.z + d.out.z * 1.7; return [reach(px, pz, 0.6), { x: d.world.x + d.out.x * 0.3, z: d.world.z, r: 1.7, use: true, until: () => tagsGot.has(id) || tagsDone }]; }),
    };
    const lectX = me === 'p1' ? -8 : 8;
    const hall = (iAmReal) => [
      reach(lectX, -57, 0.7),
      { x: lectX, z: -58.2, r: 1.5, use: true, until: () => say[me] === agreed },
      { x: lectX, z: -58.2, r: 1.5, until: () => say[other] === agreed },                           // wait for the partner to say the word
      reach(pPos[realIdx].x, pPos[realIdx].z + 3.2, 0.7),
      { x: pPos[realIdx].x, z: pPos[realIdx].z + 0.75, r: 2.0, use: true, until: () => r1Done },
      reach(0, -75, 1.2), { x: 0, z: -75.5, r: 1.2, until: () => !hallDoor.locked && hallDoor.k > 0.9 },
    ];
    void hall;
    const alcove = (i) => [reach(0, -79, 0.8), reach(i ? 8 : -8, -79.5, 1.0), reach(i ? 10.4 : -10.4, -85, 0.8), { x: i ? 11.5 : -11.5, z: -88, r: 1.5, use: true, until: () => slabDone }, reach(i ? 10.6 : -10.6, -88, 0.8), reach(0, -90, 1.2), { x: 0, z: -97.5, r: 0.8, until: () => !auDoor.locked && auDoor.k > 0.9 }];
    const chapel = (side) => [
      reach(0, -101.2, 1.0), reach(0, -104, 1.0), reach(0, -108, 1.0),
      ...(side === 's' ? [reach(-4.5, -110.4, 0.6)] : [reach(-2.6, -110.8, 0.6), reach(-2.6, -114.2, 0.6), reach(-4.5, -114.3, 0.5)]),
      { x: -4.5, z: -112.5 + (side === 's' ? 0.65 : -0.65), r: 1.5, use: true, until: () => par2.done },
      reach(2.4, -116.5, 0.8), reach(2.4, -119.8, 0.8), { x: 0, z: -120.2, r: 0.8, until: () => !chapDoor.locked && chapDoor.k > 0.9 }, reach(0, -123, 1.0),
    ];
    const garden = (i) => [
      reach(0, -124.5, 0.9), reach(2.8, -128, 0.8), reach(3.2, -131, 0.8), reach(2.6, -134.5, 0.8),
      i ? reach(1, -144, 0.8) : reach(-1, -138, 0.8),
      { x: i ? 9 : -9, z: i ? -144 : -138, r: 12, until: () => statuesDone },
      reach(0, -147, 1.0), { x: 0, z: -148.5, r: 1.0, until: () => !gate.locked && gate.k > 0.9 },
    ];
    const lychSteps = (side) => [
      reach(0, -152, 1.0),
      ...(side === 's' ? [reach(-6, -153.6, 0.7)] : [reach(-3, -153.4, 0.7), reach(-3, -158.4, 0.7), reach(-6, -158.3, 0.5)]),
      { x: -6, z: -156 + (side === 's' ? 0.65 : -0.65), r: 1.5, use: true, until: () => par3.done },
      reach(0, -160.2, 1.0), { x: 0, z: -161, r: 1.0, until: () => !lych.locked && lych.k > 0.9 }, reach(0, -165.2, 1.0),
    ];
    const common1 = [
      reach(0, -6, 0.8), { x: 0, z: -8.2, r: 0.8, until: () => !D0.locked && D0.k > 0.9 },
      reach(0, -12, 1.2), reach(0, -32, 1.2), reach(0, -36, 1.2),
    ];
    const sideOf = me === 'p1' ? 's' : 'n';
    const mk = (role) => {
      const holder = role === 'p1';
      return [
        ...common0, ...fuseStep(holder ? 0 : 1), ...common1,
        ...(holder ? cold.holder : [reach(0, -38, 1.2), ...cold.puller]),
        reach(5, -53.5, 0.8), { x: 5, z: -56, r: 0.8, until: () => !coldDoor.locked && coldDoor.k > 0.9 }, reach(5, -57, 1.0),
        ...hall(),
        ...alcove(holder ? 0 : 1),
        ...chapel(sideOf),
        ...garden(holder ? 0 : 1),
        ...lychSteps(sideOf),
        reach(0, -166.2, 0.8),
      ];
    };
    w.c6 = { par2, par3, charge, doubles, picks, log: [] };
    botSteps(w, { p1: mk('p1'), p2: mk('p2') });
    void pn; void N;
  },
};
