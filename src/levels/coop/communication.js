import * as THREE from 'three';
import { chain } from '../common.js';
import { glowMaterial } from '../../engine/materials.js';
import { retreatEnv, deck, plate, gate, sign, lantern, lake, stage, beacon, COL } from './kit.js';
import { room, button, board, panelBg, text, glyph, COLS, COL_HEX, COL_NAME, bots } from './communication-kit.js';

// Session 3 — Communication Exercise. Split information: one of you sees the clues, the other holds the controls.
// Eight stages: a lying-counsellor warm-up, a symbol/colour code door, a connector, simultaneous dials, a bomb-defusal panel,
// the patrol maze (one walks, one reads the map), a timed press-count relay, three doors with a lying counsellor, a fake finish.
// Everything puzzle-related is seeded from c.rng(salt): both machines agree, every playthrough differs. No modals (bots press consoles).

const T = 1;                       // wall thickness
const WHO = { p1: 'ORANGE', p2: 'TEAL' };
const tri = (u) => { const f = u - Math.floor(u); return f < 0.5 ? 4 * f - 1 : 3 - 4 * f; };

export default {
  id: 'coop3',
  name: 'Communication Exercise',
  music: 'l1',
  deathRule: 'self',
  completeQuip: 'You communicated. Mostly by shouting. The counsellor is calling it progress.',
  titleCam: { center: [0, 2, -40], radius: 34, height: 14 },

  build(w, game) {
    retreatEnv(w, { mood: 'dusk' });
    lake(w, -30);
    const c = w.coop, me = c.me, other = c.other;
    const tell = (r, k, o) => c.tell(r, k, o);
    const P = c.partner;
    const pl = () => game.player;
    w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    const rngInt = (r, n) => Math.floor(r() * n);
    const shuffle = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rngInt(r, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const cp = (rm, k, cx = 0) => w.checkpoint({ x: cx, y: rm.y, z: rm.at(k), real: true });
    const inRoom = (rm, cx = 0) => () => pl().z < rm.z0 - 1.2 && pl().z > rm.z1 && Math.abs(pl().x - cx) < 11;
    const roomStage = (name, rm, cx, key, k = 3) => stage(w, name, { x: cx, y: rm.y + 1.5, z: rm.at(k), w: 20, h: 4, d: 4 }, () => tell('all', key));
    const crumbles = (arr, idx, o = { delay: 1.6, gone: 3 }) => idx.forEach((i) => w.crumble(arr[i], o));
    const lanternPair = (rm, cx, k) => { lantern(w, cx - 9, rm.y, rm.at(k)); lantern(w, cx + 9, rm.y, rm.at(k)); };
    // role-coloured "who may see this" captions
    const own = (r) => `FOR ${WHO[r]} ONLY`;
    const seal = (g, W, H, msg) => { panelBg(g, W, H, '#555a66', '#101219'); text(g, 'SEALED', W / 2, H * 0.36, Math.min(H * 0.26, 56), '#6b7080'); text(g, msg, W / 2, H * 0.68, Math.min(H * 0.13, 26), '#6b7080'); };

    // ================================================================== 1. the warm-up: which door? ==================
    const R1 = room(w, { z0: 8, z1: -12, y: 0, doorsN: [{ c: -5, w: 4, gate: true }, { c: 5, w: 4, gate: true }], doorsS: [] });
    sign(w, 'SERENITY FALLS · COUPLES RETREAT', 0, 5.6, 5.5, { w: 12, h: 1.6 });
    sign(w, 'SESSION 3: COMMUNICATION EXERCISE', 0, 4.0, 5.5, { w: 10, h: 1, border: '#39d7c9' });
    lanternPair(R1, 0, 2); lanternPair(R1, 0, 14);
    const r1 = c.rng(1)();
    const truth1 = r1 < 0.5 ? 0 : 1;                                     // 0 = left, 1 = right
    const SIDE = ['LEFT', 'RIGHT'];
    board(w, { x: 0, y: 3.4, z: R1.z1 + 0.06, width: 5.6, height: 2.8, px: 560, draw: {
      p1: (g, W, H) => { panelBg(g, W, H, '#' + COL.p1.toString(16).padStart(6, '0')); text(g, 'STAFF BINDER · ' + own('p1'), W / 2, H * 0.14, 26, '#ffb36b'); text(g, 'THE EXIT IS THE', W / 2, H * 0.34, 34); text(g, SIDE[truth1] + ' DOOR', W / 2, H * 0.58, 64, '#ffc83d'); text(g, 'The counsellor\'s remarks are for morale only.', W / 2, H * 0.84, 20, '#9aa0b0', 'center', '400'); },
      p2: (g, W, H) => { panelBg(g, W, H, '#' + COL.p2.toString(16).padStart(6, '0')); text(g, 'STAFF BINDER', W / 2, H * 0.16, 28, '#7be8de'); text(g, 'THIS PAGE IS FOR ORANGE.', W / 2, H * 0.44, 34); text(g, 'Ask them. Do not ask the counsellor.', W / 2, H * 0.7, 24, '#9aa0b0', 'center', '400'); },
    } });
    const lock1 = { until: 0, done: false };
    const b1 = [-5, 5].map((x, j) => button(w, { x, z: R1.at(16.2), label: `${SIDE[j]} DOOR`, color: j ? COL.p2 : COL.p1, onPress: () => {
      if (w.t < lock1.until || lock1.done) return;
      c.set('r1:try', { j, n: (c.get('r1:try', { n: 0 }).n || 0) + 1 });
    } }));
    c.on('r1:try', (v) => {
      if (lock1.done || w.t < lock1.until) return;
      if (v.j === truth1) { lock1.done = true; R1.gatesN[truth1].set(true); b1[v.j].flash(0x3ddc97, 3); tell('all', 'coop.l3.doorok'); }
      else { lock1.until = w.t + 4.5; b1[v.j].flash(0xff4d5e, 4.5); tell('all', 'coop.l3.doorbad'); }
    });
    stage(w, 'welcome', { x: 0, y: 1, z: 3, w: 20, h: 4, d: 6 }, () => { tell('p1', 'coop.l3.intro.p1', { priority: 2 }); tell('p2', 'coop.l3.intro.p2', { priority: 2 }); });
    stage(w, 'lie1', { x: 0, y: 1, z: R1.at(8), w: 20, h: 4, d: 4 }, () => {
      tell('p1', 'coop.l3.lie.p1', { vars: { door: SIDE[1 - truth1] } });
      tell('p2', 'coop.l3.lie.p2', { vars: { door: SIDE[1 - truth1] } });
    });
    cp(R1, 5);

    // ================================================================== connector 1 ======================================
    const C1 = chain(w, { x: 0, y: 0, z: R1.z1 - T }, [
      { gap: 1, d: 4, w: 16 }, { gap: 2.6, d: 3.5, w: 6, dy: 0.6 }, { gap: 2.8, d: 3.5, w: 5, dy: 0.7 }, { gap: 2.8, d: 3.5, w: 5, dy: -0.5 }, { gap: 2.8, d: 4, w: 8, dy: -0.8 },
    ]);
    crumbles(C1, [2]);
    w.checkpoint({ x: 0, y: C1[1].top, z: C1[1].body.z, real: true });

    // ================================================================== 2. the code door =================================
    const R2 = room(w, { z0: C1.endZ - 2.4 - T, z1: C1.endZ - 2.4 - T - 20, y: C1.endY, doorsS: [{ c: 0, w: 6, gate: false }], doorsN: [{ c: 0, w: 6, gate: true }] });
    lanternPair(R2, 0, 4); lanternPair(R2, 0, 17);
    const rc = c.rng(2);
    const seq = Array.from({ length: 4 }, () => rngInt(rc, 6));
    const legend = shuffle(rc, [0, 1, 2, 3, 4, 5]);                       // legend[symbol] = colour index
    const need = seq.map((s) => legend[s]);
    const cd = { n: 0, flash: 0 };
    const lampDraw = (see) => (g, W, H) => {
      panelBg(g, W, H, see ? '#' + COL.p1.toString(16).padStart(6, '0') : '#555a66');
      text(g, see ? 'LAMPS · ' + own('p1') : 'LAMPS · ' + own('p1') + ' · ask them', W / 2, 30, 26, see ? '#ffb36b' : '#6b7080');
      for (let k = 0; k < 4; k++) {
        const bx = W * (0.14 + 0.24 * k), by = H * 0.5;
        g.fillStyle = '#0b0c12'; g.fillRect(bx - 54, by - 54, 108, 108); g.strokeStyle = '#2a3042'; g.lineWidth = 3; g.strokeRect(bx - 54, by - 54, 108, 108);
        if (see) glyph(g, seq[k], bx, by, 38, '#fff3d0'); else text(g, '?', bx, by, 60, '#3a4052');
        g.fillStyle = cd.flash > 0 ? '#ff4d5e' : k < cd.n ? '#3ddc97' : '#2a3042'; g.beginPath(); g.arc(bx, H - 36, 14, 0, 7); g.fill();
      }
    };
    const lampBoard = board(w, { x: 0, y: 4.3, z: R2.z1 + 0.06, width: 8, height: 2.9, px: 700, draw: { p1: lampDraw(true), p2: lampDraw(false) } });
    const legendDraw = (see) => (g, W, H) => {
      if (!see) return seal(g, W, H, own('p2') + ' · ask them');
      panelBg(g, W, H, '#' + COL.p2.toString(16).padStart(6, '0'));
      text(g, 'LEGEND · ' + own('p2'), W / 2, 34, 26, '#7be8de');
      for (let s = 0; s < 6; s++) {
        const y = 80 + s * ((H - 100) / 6);
        glyph(g, s, W * 0.22, y + 16, 22, '#fff3d0');
        text(g, '=', W * 0.42, y + 16, 34, '#9aa0b0');
        g.fillStyle = COLS[legend[s]]; g.beginPath(); g.arc(W * 0.6, y + 16, 20, 0, 7); g.fill();
        text(g, COL_NAME[legend[s]], W * 0.9, y + 16, 22, '#cfd6e0', 'right');
      }
    };
    board(w, { x: R2.x1 - 0.06, y: 3.6, z: R2.at(8.5), width: 5.2, height: 5.4, px: 480, rotY: -Math.PI / 2, draw: { p1: legendDraw(false), p2: legendDraw(true) } });
    const codeBtn = COL_HEX.map((hex, i) => button(w, { x: -7.5 + i * 3, z: R2.at(13), color: hex, itLabel: 'Press', onPress: () => {
      const n = c.get('cd:n', 0);
      if (n >= 4) return;
      if (i === need[n]) c.set('cd:n', n + 1);
      else { c.set('cd:n', 0); c.set('cd:bad', c.get('cd:bad', 0) + 1); }
    } }));
    c.on('cd:n', (v) => { cd.n = v; lampBoard.update(); if (v >= 4) { R2.gatesN[0].set(true); tell('all', 'coop.l3.codeok'); } });
    c.on('cd:bad', () => { cd.flash = 1.4; lampBoard.update(); codeBtn.forEach((b) => b.flash(0xff4d5e, 1.0)); tell('all', 'coop.l3.codebad'); });
    w.updaters.push((dt) => { if (cd.flash > 0) { cd.flash -= dt; if (cd.flash <= 0) lampBoard.update(); } });
    roomStage('code', R2, 0, 'coop.l3.code', 4);
    cp(R2, 2.5);

    // ================================================================== connector 2 ======================================
    const C2 = chain(w, { x: 0, y: R2.y, z: R2.z1 - T }, [
      { gap: 1, d: 4, w: 6 }, { gap: 2.8, d: 3.5, w: 5, dy: 0.6 }, { gap: 2.8, d: 3.5, w: 4.5, dy: 0.6 }, { gap: 2.8, d: 3.5, w: 5, dy: -0.6 }, { gap: 2.8, d: 3.5, w: 5, dy: -0.4 }, { gap: 2.6, d: 4, w: 7, dy: -0.2 },
    ]);
    crumbles(C2, [2, 4]);
    w.checkpoint({ x: 0, y: C2[0].top, z: C2[0].body.z, real: true });

    // ================================================================== 3. the dials =====================================
    const R3 = room(w, { z0: C2.endZ - 2.4 - T, z1: C2.endZ - 2.4 - T - 20, y: C2.endY, doorsS: [{ c: 0, w: 6, gate: false }], doorsN: [{ c: 0, w: 6, gate: true }] });
    lanternPair(R3, 0, 4); lanternPair(R3, 0, 17);
    const rd = c.rng(3);
    const dialT = Array.from({ length: 4 }, () => 1 + rngInt(rd, 6));       // targets 1..6 (dials run 0..6)
    const DN = ['A', 'B', 'C', 'D'];
    const dialOwner = ['p1', 'p1', 'p2', 'p2'];
    const dv = [0, 0, 0, 0];
    const dialBoard = [];
    const dialBtn = [-7, -3, 3, 7].map((x, i) => {
      const dcol = dialOwner[i] === 'p1' ? COL.p1 : COL.p2;
      const bd = board(w, { x, y: 3.1, z: R3.at(11.4), width: 1.9, height: 1.5, px: 256, draw: { all: (g, W, H) => {
        panelBg(g, W, H, '#' + dcol.toString(16).padStart(6, '0'));
        text(g, `DIAL ${DN[i]}`, W / 2, H * 0.2, 28, dialOwner[i] === 'p1' ? '#ffb36b' : '#7be8de');
        text(g, String(dv[i]), W / 2, H * 0.62, 90, '#fff3d0');
      } } });
      dialBoard.push(bd);
      return button(w, { x, z: R3.at(11), color: dcol, label: `TURN ${DN[i]}`, onPress: () => { if (c.get('dials:ok')) return; c.set('dial:' + i, (c.get('dial:' + i, 0) + 1) % 7); } });
    });
    dialBtn.forEach((_, i) => c.on('dial:' + i, (v) => { dv[i] = v; dialBoard[i].update(); }));
    const dialsRight = () => dv.every((v, i) => v === dialT[i]);
    let dialHold = 0;
    const tgtDraw = (see, who, idx) => (g, W, H) => {
      if (!see) return seal(g, W, H, 'the other one reads this');
      panelBg(g, W, H, '#' + (who === 'p1' ? COL.p2 : COL.p1).toString(16).padStart(6, '0'));
      text(g, `TARGETS FOR ${WHO[who]}'S DIALS`, W / 2, H * 0.14, 24, '#cfd6e0');
      text(g, `${DN[idx[0]]} = ${dialT[idx[0]]}`, W * 0.3, H * 0.6, 70, '#fff3d0');
      text(g, `${DN[idx[1]]} = ${dialT[idx[1]]}`, W * 0.72, H * 0.6, 70, '#fff3d0');
      text(g, 'Each of you turns the other\'s dials... no. Your own. Read theirs aloud.', W / 2, H * 0.9, 15, '#7a8092', 'center', '400');
    };
    // west wall: shown to ORANGE (p1), lists TEAL's targets (C, D); east wall: shown to TEAL (p2), lists ORANGE's targets (A, B)
    board(w, { x: R3.x0 + 0.06, y: 3.6, z: R3.at(9), width: 5.4, height: 3.2, px: 540, rotY: Math.PI / 2, draw: { p1: tgtDraw(true, 'p2', [2, 3]), p2: tgtDraw(false) } });
    board(w, { x: R3.x1 - 0.06, y: 3.6, z: R3.at(9), width: 5.4, height: 3.2, px: 540, rotY: -Math.PI / 2, draw: { p2: tgtDraw(true, 'p1', [0, 1]), p1: tgtDraw(false) } });
    const lockLamp = board(w, { x: 0, y: 4.4, z: R3.z1 + 0.06, width: 6, height: 1.6, px: 600, draw: { all: (g, W, H) => {
      const ok = c.get('dials:ok'), near = dv.filter((v, i) => v === dialT[i]).length;
      panelBg(g, W, H, ok ? '#3ddc97' : '#ffc83d'); text(g, ok ? 'LOCK OPEN' : 'ALL FOUR DIALS · ONE LOCK', W / 2, H * 0.4, 42, ok ? '#3ddc97' : '#fff3d0');
      text(g, ok ? 'Well. That was nearly intimate.' : 'It only tells you when you are right.', W / 2, H * 0.78, 20, '#9aa0b0', 'center', '400'); void near;
    } } });
    w.updaters.push((dt) => {
      if (c.get('dials:ok')) return;
      dialHold = dialsRight() ? dialHold + dt : 0;
      if (dialHold > 1.2) c.set('dials:ok', true);
    });
    c.on('dials:ok', (v) => { if (!v) return; R3.gatesN[0].set(true); lockLamp.update(); tell('all', 'coop.l3.dialsok'); });
    roomStage('dials', R3, 0, 'coop.l3.dials', 4);
    cp(R3, 2.5);

    // ================================================================== connector 3 ======================================
    const C3 = chain(w, { x: 0, y: R3.y, z: R3.z1 - T }, [
      { gap: 1, d: 4, w: 6 }, { gap: 2.6, d: 3.5, w: 5, dy: 0.7 }, { gap: 2.8, d: 3.5, w: 4.5, dy: 0.6 }, { gap: 3.0, d: 3.5, w: 5, dy: -0.5 }, { gap: 2.8, d: 4, w: 7, dy: -0.8 },
    ]);
    crumbles(C3, [1, 3]);
    w.checkpoint({ x: 0, y: C3[0].top, z: C3[0].body.z, real: true });

    // ================================================================== 4. the bomb panel ================================
    const R4 = room(w, { z0: C3.endZ - 2.4 - T, z1: C3.endZ - 2.4 - T - 20, y: C3.endY, doorsS: [{ c: 0, w: 6, gate: false }], doorsN: [{ c: 0, w: 6, gate: true }] });
    lanternPair(R4, 0, 4); lanternPair(R4, 0, 17);
    const rb = c.rng(4);
    const solveWires = (ws) => { const y = ws.indexOf(3); if (y >= 0) return (y + 1) % 5; if (ws.filter((x) => x === 0).length >= 2) return ws.lastIndexOf(0); return 2; };
    const genWires = (round) => {
      for (let tries = 0; tries < 800; tries++) {
        const ws = Array.from({ length: 5 }, () => rngInt(rb, 5));
        const hasY = ws.includes(3), reds = ws.filter((x) => x === 0).length;
        if (round === 0 ? hasY : round === 1 ? !hasY && reds >= 2 : !hasY && reds <= 1) return ws;
      }
      return round === 0 ? [0, 1, 3, 2, 4] : round === 1 ? [0, 1, 0, 2, 4] : [1, 2, 4, 2, 1];
    };
    const ROUNDS = 3;
    const wires = [0, 1, 2].map(genWires);
    const bomb = { r: 0, flash: 0, cut: -1 };
    const WIRE_CSS = ['#ff5a5f', '#4aa3ff', '#3ddc97', '#ffd23f', '#f4f4f4'];
    const panelDraw = (see) => (g, W, H) => {
      panelBg(g, W, H, bomb.flash > 0 ? '#ff4d5e' : see ? '#' + COL.p2.toString(16).padStart(6, '0') : '#555a66', bomb.flash > 0 ? '#2a0f14' : '#14161f');
      text(g, bomb.r >= ROUNDS ? 'DEFUSED' : `CONTROL PANEL · ROUND ${bomb.r + 1} OF ${ROUNDS}`, W / 2, 34, 28, bomb.r >= ROUNDS ? '#3ddc97' : see ? '#7be8de' : '#6b7080');
      if (bomb.flash > 0) text(g, 'WRONG WIRE · THEY GROW BACK · START THE ROUND', W / 2, H * 0.52, 26, '#ff9aa5');
      else if (bomb.r < ROUNDS) {
        const ws = wires[bomb.r];
        for (let k = 0; k < 5; k++) {
          const px = W * (0.1 + 0.2 * k);
          g.strokeStyle = see ? WIRE_CSS[ws[k]] : '#4a4f5e'; g.lineWidth = 16; g.lineCap = 'round';
          g.beginPath(); g.moveTo(px, 70); g.bezierCurveTo(px + 30, H * 0.4, px - 30, H * 0.62, px, H - 70); g.stroke();
        }
        if (!see) text(g, 'WIRES · ' + own('p2'), W / 2, H * 0.5, 30, '#6b7080');
      }
      for (let k = 0; k < 5; k++) text(g, String(k + 1), W * (0.1 + 0.2 * k), H - 34, 34, '#cfd6e0');
    };
    const bombBoard = board(w, { x: 0, y: 4.3, z: R4.z1 + 0.06, width: 10, height: 3.2, px: 800, draw: { p1: panelDraw(false), p2: panelDraw(true) } });
    const manual = (g, W, H) => {
      panelBg(g, W, H, '#' + COL.p1.toString(16).padStart(6, '0'));
      text(g, 'DEFUSAL MANUAL · ' + own('p1'), W / 2, 34, 24, '#ffb36b');
      text(g, 'Wires are numbered 1-5, left to right.', W / 2, 74, 18, '#9aa0b0', 'center', '400');
      const rows = [['RULE 1', 'Any YELLOW wire? Cut the wire just RIGHT of the', 'first yellow. (Yellow is last? Cut wire 1.)'], ['RULE 2', 'Else, two or more RED? Cut the LAST red wire.', ''], ['RULE 3', 'Else, cut wire 3.', ''], ['', 'Wrong wire? They grow back. Nobody dies.', 'We just all feel worse.']];
      rows.forEach((r, i) => { const y = 140 + i * 82; text(g, r[0], 30, y, 28, '#ffc83d', 'left'); text(g, r[1], 150, y - 10, 19, '#fff3d0', 'left', '400'); text(g, r[2], 150, y + 18, 19, '#fff3d0', 'left', '400'); });
    };
    board(w, { x: R4.x0 + 0.06, y: 3.6, z: R4.at(9), width: 7, height: 4.4, px: 700, rotY: Math.PI / 2, draw: { p1: manual, p2: (g, W, H) => seal(g, W, H, 'the manual is ' + own('p1')) } });
    const cutBtn = [-4, -2, 0, 2, 4].map((x, k) => button(w, { x, z: R4.at(15.2), color: 0xf4f4f4, label: `CUT ${k + 1}`, onPress: () => {
      if (bomb.r >= ROUNDS || bomb.flash > 0) return;
      const r = c.get('bomb:r', 0);
      if (k === solveWires(wires[r])) c.set('bomb:r', r + 1);
      else c.set('bomb:bad', c.get('bomb:bad', 0) + 1);
    } }));
    c.on('bomb:r', (v) => { bomb.r = v; bombBoard.update(); if (v >= ROUNDS) { R4.gatesN[0].set(true); tell('all', 'coop.l3.bombok'); } else if (v > 0) tell('all', 'coop.l3.bombround'); });
    c.on('bomb:bad', () => { bomb.flash = 1.8; bombBoard.update(); cutBtn.forEach((b) => b.flash(0xff4d5e, 1.0)); tell('all', 'coop.l3.bombbad'); });
    w.updaters.push((dt) => { if (bomb.flash > 0) { bomb.flash -= dt; if (bomb.flash <= 0) bombBoard.update(); } });
    roomStage('bomb', R4, 0, 'coop.l3.bomb', 4);
    cp(R4, 2.5);

    // ================================================================== connector 4 ======================================
    const C4 = chain(w, { x: 0, y: R4.y, z: R4.z1 - T }, [
      { gap: 1, d: 4, w: 6 }, { gap: 2.8, d: 3.5, w: 5, dy: 0.6 }, { gap: 2.8, d: 3.5, w: 5, dy: 0.6 }, { gap: 2.8, d: 3.5, w: 5, dy: -0.6 }, { gap: 2.8, d: 4, w: 7, dy: -0.6 },
    ]);
    crumbles(C4, [2]);

    // ================================================================== 5. the maze ======================================
    const Zlob = C4.endZ - 2.4 - T;                                  // lobby south interior edge
    const LOB = 14;
    const MY = C4.endY;
    const zDiv = Zlob - LOB - T / 2;                                 // divider between lobby and maze (centre)
    const zS = Zlob - LOB - T;                                       // maze south edge
    const zN = zS - 36;
    const XC = (col) => -16 + 4 * col, ZC = (gr) => zS - 2 - 4 * gr;
    const MZ = room(w, { x0: -18, x1: 18, z0: Zlob, z1: zN, y: MY, doorsS: [{ c: 0, w: 6, gate: false }], doorsN: [{ c: 16, w: 4, gate: true }] });
    const wallSeg = (cx, cz, ww, dd, hi = MY + 7, lo = MY - 3) => w.plat({ x: cx, y: hi, z: cz, w: ww, d: dd, h: hi - lo, tex: 'wood', color: 0xd9c8a8, radius: 0.03 });
    // divider with the maze entrance (gate) at the west end
    wallSeg(2, zDiv, 32, T);                                         // x -14 .. 18 (the entrance gap is x -18 .. -14)
    const entry = gate(w, { x: -16, y: MY, z: zDiv, w: 4, h: 5, d: T, color: 0x8a6a45 });
    wallSeg(-16, zDiv, 4, T, MY + 7, MY + 5);                        // lintel
    // booth for the map reader (east side of the lobby): walls south and west, doorway on the west wall
    const bz0 = Zlob - 3, bz1 = zDiv;                                // booth z span (south edge, north edge)
    wallSeg(12.5, bz0, 11, T);                                       // south wall x 7..18
    const bdoor = (bz0 + bz1) / 2;
    wallSeg(6.5, (bz0 + bdoor + 2) / 2 + 0.25, T, bz0 - bdoor - 2 + 0.5);
    wallSeg(6.5, (bdoor - 2 + bz1) / 2, T, bdoor - 2 - bz1);
    wallSeg(6.5, bdoor, T, 4, MY + 7, MY + 4.4);                     // lintel over the booth doorway
    const walker = 'p2', reader = 'p1';
    const open = Array.from({ length: 9 }, () => Array(9).fill(false));
    const setO = (gr, cols) => cols.forEach((cl) => { open[gr][cl] = true; });
    setO(0, [0, 2, 4]); setO(1, [0, 1, 2, 3, 4, 5, 6, 7, 8]); setO(2, [2, 4, 8]); setO(3, [3, 5, 8]); setO(4, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    setO(5, [0, 3, 5]); setO(6, [0, 2, 6]); setO(7, [0, 1, 2, 3, 4, 5, 6, 7, 8]); setO(8, [2, 6, 8]);
    for (let gr = 0; gr < 9; gr++) {
      let col = 0;
      while (col < 9) {
        if (open[gr][col]) { col++; continue; }
        let e = col; while (e < 9 && !open[gr][e]) e++;
        wallSeg(-18 + 2 * (col + e), ZC(gr), 4 * (e - col), 4);
        col = e;
      }
    }
    // patrols: cross traffic through the junctions of the three route rows
    const rm = c.rng(5);
    const LANES = [];
    [[1, [2, 4]], [4, [3, 5]], [7, [2, 6]]].forEach(([gr, cols]) => cols.forEach((col) => {
      const per = 5.8 + rm() * 1.3, ph = rm();
      LANES.push({ gr, col, cx: XC(col), cz: ZC(gr), per, ph, east: gr !== 4, off: (t) => 4 * tri(t / per + ph) });
    }));
    const patrolMat = [];
    LANES.forEach((L) => {
      const strip = w.box({ x: L.cx, y: MY + 0.03, z: L.cz, w: 3.4, h: 0.04, d: 9.6, color: 0x5a1c28, emissive: 0x2a060c, shadow: false });
      void strip;
      L.hz = w.hazard({ x: L.cx, y: MY + 1.0, z: L.cz, w: 3.6, h: 2.0, d: 1.6, color: 0xff3d57, move: (t) => ({ z: L.off(t) }) });
      patrolMat.push(L.hz);
    });
    const conflict = (L, t) => Math.abs(L.off(t)) < 1.5;
    const freeFor = (L, h = 1.5, from = 0.05) => { for (let s = from; s <= h; s += 0.1) if (conflict(L, w.t + s)) return false; return true; };
    const timeToConflict = (L) => { if (conflict(L, w.t)) return 0; for (let s = 0.05; s < 4; s += 0.05) if (conflict(L, w.t + s)) return s; return 4; };
    // map desk
    const mazeState = { done: false };
    const MAPW = 6.4, mpx = 512;
    const route = [[0, 0], [0, 1], [8, 1], [8, 4], [0, 4], [0, 7], [8, 7], [8, 8]];
    const mapDraw = (see) => (g, W, H) => {
      if (!see) return seal(g, W, H, own(reader) + ' · map desk');
      const s = W / 36, mx = (x) => (x + 18) * s, mz = (z) => (z - zN) * s;
      g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H);
      for (let gr = 0; gr < 9; gr++) for (let col = 0; col < 9; col++) {
        if (!open[gr][col]) continue;
        g.fillStyle = '#2a3042'; g.fillRect(mx(XC(col) - 1.9), mz(ZC(gr) - 1.9), 3.8 * s, 3.8 * s);
      }
      g.strokeStyle = 'rgba(255,200,61,0.7)'; g.lineWidth = 3; g.setLineDash([8, 7]); g.beginPath();
      route.forEach(([col, gr], i) => g[i ? 'lineTo' : 'moveTo'](mx(XC(col)), mz(ZC(gr)))); g.stroke(); g.setLineDash([]);
      text(g, 'START', mx(XC(0)), mz(ZC(0)) + 8, 18, '#ffc83d'); text(g, 'EXIT', mx(XC(8)), mz(ZC(8)) + 4, 20, '#3ddc97');
      for (const L of LANES) {
        g.strokeStyle = 'rgba(255,61,87,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(mx(L.cx), mz(L.cz - 4)); g.lineTo(mx(L.cx), mz(L.cz + 4)); g.stroke();
        const live = !mazeState.done;
        const tc = live ? timeToConflict(L) : 4;
        g.strokeStyle = !live ? '#3ddc97' : tc > 1.7 ? '#3ddc97' : tc > 0.8 ? '#ffd23f' : '#ff4d5e'; g.lineWidth = 5;
        g.beginPath(); g.arc(mx(L.cx), mz(L.cz), 1.2 * s + 4, 0, 7); g.stroke();
        if (live) { g.fillStyle = '#ff3d57'; g.fillRect(mx(L.cx - 1.8), mz(L.cz + L.off(w.t) - 0.8), 3.6 * s, 1.6 * s); }
      }
      if (P.has) { g.fillStyle = '#' + COL[walker].toString(16).padStart(6, '0'); g.beginPath(); g.arc(mx(P.sx), mz(P.sz), 8, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
      g.strokeStyle = '#ffc83d'; g.lineWidth = 5; g.strokeRect(3, 3, W - 6, H - 6);
    };
    const screen = board(w, { x: 12.5, y: 3.6, z: zDiv + T / 2 + 0.06, width: MAPW, height: MAPW, px: mpx, draw: { p1: mapDraw(true), p2: mapDraw(false) } });
    let mapT = 0;
    if (me === reader) w.updaters.push((dt) => { mapT -= dt; if (mapT <= 0) { mapT = 0.1; screen.update(); } });
    const desk = plate(w, { x: 12.5, y: MY, z: Zlob - 8, need: reader }, () => {});
    sign(w, 'MAP DESK · STAND ON THE PAD', 12.5, MY + 2.6, bz0 - T / 2 - 0.05, { w: 6, h: 0.9, size: 30 });
    w.updaters.push(() => { entry.set(desk.pressed || mazeState.done); });
    sign(w, `${WHO[walker]} WALKS. ${WHO[reader]} HAS THE MAP.`, -6, MY + 5.2, Zlob - 5, { w: 11, h: 1.3, size: 30 });
    sign(w, 'THE ENTRANCE OPENS WHILE THE MAP DESK IS MANNED', -9, MY + 3.4, zDiv + 1.5, { w: 8, h: 1, size: 26, border: '#39d7c9' });
    const shut = button(w, { x: 16, z: ZC(8) - 1.2, color: 0x3ddc97, label: 'SHUT DOWN PATROLS', onPress: () => { if (!c.get('maze:done')) c.set('maze:done', true); } });
    c.on('maze:done', (v) => {
      if (!v) return; mazeState.done = true;
      LANES.forEach((L) => { L.hz.enabled = false; L.hz.group.visible = false; });
      MZ.gatesN[0].set(true); screen.update(); tell('all', 'coop.l3.mazedone');
    });
    // checkpoints on the route (turn cells, never in a patrol lane)
    w.checkpoint({ x: -4, y: MY, z: Zlob - 3.4, real: true });
    w.checkpoint({ x: XC(8), y: MY, z: ZC(3), real: true });
    w.checkpoint({ x: XC(0), y: MY, z: ZC(6), real: true });
    stage(w, 'maze', { x: 0, y: MY + 1.5, z: Zlob - 3, w: 36, h: 4, d: 5 }, () => { tell(reader, 'coop.l3.maze.reader'); tell(walker, 'coop.l3.maze.walker'); });
    stage(w, 'mazelive', { x: XC(0), y: MY + 1.5, z: ZC(1), w: 4, h: 4, d: 4 }, () => tell('all', 'coop.l3.mazelive'));
    stage(w, 'mazetwo', { x: XC(0), y: MY + 1.5, z: ZC(7), w: 4, h: 4, d: 4 }, () => tell('all', 'coop.l3.mazetwo'));
    lantern(w, -15, MY, Zlob - 1); lantern(w, 15, MY, zDiv + 8);

    // ================================================================== connector 5 (x = 16) =============================
    const CX = 16;
    const C5 = chain(w, { x: CX, y: MY, z: zN - T }, [
      { gap: 1, d: 4, w: 6 }, { gap: 2.8, d: 3.5, w: 5, dy: 0.6 }, { gap: 2.8, d: 3.5, w: 4.5, dy: 0.7 }, { gap: 2.8, d: 3.5, w: 5, dy: -0.5 }, { gap: 2.8, d: 4, w: 7, dy: -0.8 },
    ]);
    crumbles(C5, [2]);
    w.checkpoint({ x: CX, y: C5[0].top, z: C5[0].body.z, real: true });

    // ================================================================== 6. the relay =====================================
    const R6 = room(w, { x0: CX - 10, x1: CX + 10, z0: C5.endZ - 2.4 - T, z1: C5.endZ - 2.4 - T - 20, y: C5.endY, doorsS: [{ c: CX, w: 6, gate: false }], doorsN: [{ c: CX, w: 6, gate: true }] });
    lanternPair(R6, CX, 4); lanternPair(R6, CX, 17);
    const WIN = 22;
    const rl = { att: 0, cnt: [0, 0], lock: [false, false], t0: null, last: [-9, -9], ok: false, bad: [0, 0] };
    const rtgt = (side, att = rl.att) => 3 + rngInt(c.rng(60 + att * 2 + side), 6);
    const side = (r) => (r === 'p1' ? 0 : 1);
    const relayTgt = (see, sd) => (g, W, H) => {
      if (!see) return seal(g, W, H, 'the other one reads this');
      panelBg(g, W, H, '#' + (sd === 0 ? COL.p1 : COL.p2).toString(16).padStart(6, '0'));
      text(g, `${WHO[sd ? 'p2' : 'p1']} MUST PRESS`, W / 2, H * 0.22, 26, '#cfd6e0'); text(g, `${rtgt(sd)} TIMES`, W / 2, H * 0.68, 64, '#fff3d0');
    };
    const relayBoards = [0, 1].map((sd) => board(w, { x: CX + (sd ? 5 : -5), y: 4.4, z: R6.z1 + 0.06, width: 4.2, height: 1.9, px: 420, draw: { p1: relayTgt(sd === 1, sd), p2: relayTgt(sd === 0, sd) } }));
    const cntDraw = (sd) => (g, W, H) => {
      const L = rl.lock[sd], b = rl.bad[sd] > 0;
      panelBg(g, W, H, L ? '#3ddc97' : b ? '#ff4d5e' : '#' + (sd ? COL.p2 : COL.p1).toString(16).padStart(6, '0'));
      text(g, b ? 'TOO MANY' : L ? 'LOCKED' : 'PRESSED', W / 2, H * 0.2, 22, b ? '#ff9aa5' : L ? '#3ddc97' : '#cfd6e0'); text(g, String(rl.cnt[sd]), W / 2, H * 0.64, 70, '#fff3d0');
    };
    const cntBoards = [0, 1].map((sd) => board(w, { x: CX + (sd ? 5 : -5), y: 2.95, z: R6.at(16.2), width: 1.9, height: 1.5, px: 256, draw: { all: cntDraw(sd) } }));
    const timerBoard = board(w, { x: CX, y: 3.6, z: R6.z1 + 0.06, width: 5, height: 1.5, px: 500, draw: { all: (g, W, H) => {
      panelBg(g, W, H, rl.ok ? '#3ddc97' : '#ffc83d');
      if (rl.ok) { text(g, 'RELAYED', W / 2, H / 2, 46, '#3ddc97'); return; }
      const left = rl.t0 === null ? WIN : Math.max(0, rl.t0 + WIN - w.t);
      text(g, rl.t0 === null ? `${WIN} S · STARTS ON FIRST PRESS` : `${left.toFixed(1)} S`, W / 2, H * 0.36, rl.t0 === null ? 26 : 50, left < 6 ? '#ff9aa5' : '#fff3d0');
      g.fillStyle = '#2a3042'; g.fillRect(40, H * 0.68, W - 80, 22); g.fillStyle = left < 6 ? '#ff4d5e' : '#ffc83d'; g.fillRect(40, H * 0.68, (W - 80) * (left / WIN), 22);
    } } });
    w.dbg = { rl, rtgt, get rooms() { return { R1: [R1.z0, R1.z1], R2: [R2.z0, R2.z1], R3: [R3.z0, R3.z1], R4: [R4.z0, R4.z1], R6: [R6.z0, R6.z1], R7: [R7.z0, R7.z1], y: [R1.y, R2.y, R3.y, R4.y, R6.y, R7.y] }; }, get geo() { return { Zlob, zDiv, zS, zN, MY, c4: C4.endZ, c4y: C4.endY }; } };
    const bothIn = c.zone({ x: CX, y: R6.y + 1.5, z: R6.at(10), w: 19, h: 4, d: 19, need: 'both', shrink: 0 });
    const rbtn = [0, 1].map((sd) => button(w, { x: CX + (sd ? 5 : -5), z: R6.at(17.6), color: sd ? COL.p2 : COL.p1, label: `${WHO[sd ? 'p2' : 'p1']}'S BUTTON`, enabled: () => me === (sd ? 'p2' : 'p1'), onPress: () => {
      if (rl.lock[sd] || rl.ok) return;
      if (!bothIn.active) { game.ui.toast?.('Wait for your partner to be in the room', 'bad'); return; }
      if (rl.t0 === null) c.set('rl:t0', { att: rl.att, t: w.t });
      const n = rl.cnt[sd] + 1;
      rl.last[sd] = w.t;
      if (n > rtgt(sd)) { c.set('rl:c' + sd, 0); c.emit('rl:over', { sd, att: rl.att }); } else c.set('rl:c' + sd, n);
    } }));
    [0, 1].forEach((sd) => {
      c.on('rl:c' + sd, (v) => { rl.cnt[sd] = v; cntBoards[sd].update(); });
      c.on('rl:l' + sd, (v) => { if (v.att !== rl.att) return; rl.lock[sd] = true; cntBoards[sd].update(); rbtn[sd].recolor(0x3ddc97); if (rl.lock[0] && rl.lock[1] && !rl.ok) { rl.ok = true; R6.gatesN[0].set(true); timerBoard.update(); tell('all', 'coop.l3.relayok'); } });
    });
    c.on('rl:t0', (v) => { if (v.att === rl.att && rl.t0 === null) rl.t0 = v.t; });
    c.onEvent('rl:over', (v) => { if (v.att !== rl.att) return; rl.cnt[v.sd] = 0; rl.bad[v.sd] = 1.3; cntBoards[v.sd].update(); rbtn[v.sd].flash(0xff4d5e, 1); tell('all', 'coop.l3.relayover'); });
    c.on('rl:att', (v) => {
      if (v === rl.att) return;
      rl.att = v; rl.cnt = [0, 0]; rl.lock = [false, false]; rl.t0 = null;
      relayBoards.forEach((b) => b.update()); cntBoards.forEach((b) => b.update()); rbtn.forEach((b, i) => b.recolor(i ? COL.p2 : COL.p1)); timerBoard.update();
      tell('all', 'coop.l3.relayfail');
    });
    let tbT = 0;
    w.updaters.push((dt) => {
      for (let sd = 0; sd < 2; sd++) if (rl.bad[sd] > 0) { rl.bad[sd] -= dt; if (rl.bad[sd] <= 0) cntBoards[sd].update(); }
      const mine = side(me);                                          // I settle my own button's count
      if (!rl.lock[mine] && !rl.ok && rl.cnt[mine] === rtgt(mine) && w.t - rl.last[mine] > 1.2) c.set('rl:l' + mine, { att: rl.att });
      if (c.isHost && !rl.ok && rl.t0 !== null && w.t > rl.t0 + WIN) c.set('rl:att', rl.att + 1);
      tbT -= dt; if (tbT <= 0) { tbT = 0.1; if (rl.t0 !== null && !rl.ok) timerBoard.update(); }
    });
    sign(w, 'EACH OF YOU CAN SEE THE OTHER ONE\'S NUMBER.', CX, R6.y + 6.2, R6.at(6), { w: 11, h: 1.2, size: 30 });
    roomStage('relay', R6, CX, 'coop.l3.relay', 4);
    cp(R6, 2.5, CX);

    // ================================================================== connector 6 ======================================
    const C6 = chain(w, { x: CX, y: R6.y, z: R6.z1 - T }, [
      { gap: 1, d: 4, w: 6 }, { gap: 2.8, d: 3.5, w: 5, dy: 0.7 }, { gap: 2.8, d: 3.5, w: 4.5, dy: -0.6 }, { gap: 2.8, d: 4, w: 7, dy: -0.1 },
    ]);
    crumbles(C6, [1]);

    // ================================================================== 7. three doors, a lying counsellor ================
    const R7 = room(w, { x0: CX - 10, x1: CX + 10, z0: C6.endZ - 2.4 - T, z1: C6.endZ - 2.4 - T - 20, y: C6.endY, doorsS: [{ c: CX, w: 6, gate: false }], doorsN: [{ c: CX - 6.5, w: 4, gate: true }, { c: CX, w: 4, gate: true }, { c: CX + 6.5, w: 4, gate: true }] });
    lanternPair(R7, CX, 4); lanternPair(R7, CX, 17);
    const r7 = c.rng(7);
    const exit7 = rngInt(r7, 3);
    const wrong7 = [0, 1, 2].filter((d) => d !== exit7);
    const [na, nb] = shuffle(r7, wrong7);                                  // ORANGE's binder says "not na", TEAL's says "not nb"
    const lieA = wrong7[rngInt(r7, 2)], lieB = wrong7[rngInt(r7, 2)];      // the counsellor's (false) advice to each
    const hintDraw = (see, who, n) => (g, W, H) => {
      if (!see) return seal(g, W, H, 'the other one reads this');
      panelBg(g, W, H, '#' + COL[who].toString(16).padStart(6, '0'));
      text(g, 'STAFF BINDER · ' + own(who), W / 2, H * 0.14, 22, who === 'p1' ? '#ffb36b' : '#7be8de'); text(g, `DOOR ${n + 1}`, W / 2, H * 0.5, 80, '#fff3d0'); text(g, 'IS NOT THE EXIT.', W / 2, H * 0.84, 34);
    };
    board(w, { x: R7.x0 + 0.06, y: 3.5, z: R7.at(9), width: 4.6, height: 3.4, px: 460, rotY: Math.PI / 2, draw: { p1: hintDraw(true, 'p1', na), p2: hintDraw(false) } });
    board(w, { x: R7.x1 - 0.06, y: 3.5, z: R7.at(9), width: 4.6, height: 3.4, px: 460, rotY: -Math.PI / 2, draw: { p2: hintDraw(true, 'p2', nb), p1: hintDraw(false) } });
    const lock7 = { until: 0, done: false };
    const b7 = [0, 1, 2].map((d) => button(w, { x: CX - 6.5 + d * 6.5, z: R7.at(16.4), color: [COL.p1, COL.both, COL.p2][d], label: `DOOR ${d + 1}`, onPress: () => {
      if (lock7.done || w.t < lock7.until) return;
      c.set('r7:try', { d, n: (c.get('r7:try', { n: 0 }).n || 0) + 1 });
    } }));
    c.on('r7:try', (v) => {
      if (lock7.done || w.t < lock7.until) return;
      if (v.d === exit7) { lock7.done = true; R7.gatesN[exit7].set(true); b7[v.d].flash(0x3ddc97, 3); tell('all', 'coop.l3.door3ok'); }
      else { lock7.until = w.t + 6; b7[v.d].flash(0xff4d5e, 6); tell('all', 'coop.l3.door3bad'); }
    });
    const lie3 = () => tell(me, me === 'p1' ? 'coop.l3.lie3.p1' : 'coop.l3.lie3.p2', { priority: 2, vars: { door: (me === 'p1' ? lieA : lieB) + 1 } });
    button(w, { x: CX, z: R7.at(6), color: 0xffffff, label: 'ASK THE COUNSELLOR', onPress: () => lie3() });
    stage(w, 'doors3', { x: CX, y: R7.y + 1.5, z: R7.at(5), w: 20, h: 4, d: 4 }, () => { tell('all', 'coop.l3.doors3'); w.after(7, lie3); });
    cp(R7, 2.5, CX);

    // ================================================================== 8. the fake finish, then the real one ============
    const nookZ = R7.z1 - T - 1;                                          // just outside the doors
    const N0 = deck(w, { x: CX, y: R7.y, z: nookZ - 6, w: 22, d: 12, path: true });
    const fz = nookZ - 6;
    const fake = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 12, 48), glowMaterial(0x3ddc97, 2));
    fake.position.set(CX - 7, R7.y + 1.9, fz); w.add(fake);
    sign(w, 'FINISH', CX - 7, R7.y + 4.4, fz, { w: 4, h: 1, border: '#3ddc97' });
    let fakeDone = false;
    c.zone({ x: CX - 7, y: R7.y + 1.9, z: fz, w: 3, h: 3.4, d: 3, need: 'both', shrink: 0 }).onChange((zn) => { if (zn.active && !fakeDone) { fakeDone = true; tell('all', 'coop.l3.fake'); fake.visible = false; } });
    w.checkpoint({ x: CX + 5, y: R7.y, z: fz, real: true });
    stage(w, 'nook', { x: CX, y: R7.y + 1.5, z: fz + 3, w: 22, h: 4, d: 4 }, () => tell('all', 'coop.l3.nook'));
    const ST = chain(w, { x: CX + 5, y: R7.y, z: nookZ - 12 }, Array.from({ length: 8 }, (_, i) => ({ gap: i === 0 ? 1.8 : 1.6, d: 4, w: 6 - (i % 3), dy: 1.2 })));
    crumbles(ST, [4], { delay: 1.0, gone: 3 });
    w.checkpoint({ x: CX + 5, y: ST[3].top, z: ST[3].body.z, real: true });
    const gy = ST.endY + 1.0, gz = ST.endZ - 1.8 - 7;
    deck(w, { x: CX + 5, y: gy, z: gz, w: 14, d: 14, path: true });
    w.goal({ x: CX + 5, y: gy, z: gz });
    sign(w, 'BOTH OF YOU. IN THE CIRCLE. YES, AGAIN.', CX + 5, gy + 5.2, gz - 5, { w: 10, h: 1.6 });
    beacon(w, CX + 5, gy, gz, 0xffe9a8, 20);
    for (const lx of [-5, 5]) lantern(w, CX + 5 + lx, gy, gz + 2);
    stage(w, 'circle', { x: CX + 5, y: gy + 1, z: gz + 4, w: 14, h: 4, d: 6 }, () => tell('all', 'coop.l3.circle'));
    w.hooks.onPartnerDeath = () => { tell('all', 'coop.l3.partnerdown'); return true; };

    // ================================================================== bots =============================================
    const p1 = me === 'p1';
    const dropStep = (rm, cx, prog) => [{ x: cx, z: rm.z1 - T - 1.6, r: 0.9, ok: prog }];
    const toRoom = (rm, cx) => [{ follow: true, until: () => pl().z < rm.z0 - 1.2 && pl().grounded }, { x: cx, z: rm.at(3), r: 1.2 }];
    const goHere = (x, z) => ({ x, z, r: 0.9 });
    const pass = (rm, gi, cx) => [{ wait: () => rm.gatesN[gi].passable, at: { x: cx, z: rm.z1 + 2.5 } }, ...dropStep(rm, cx)];
    void dropStep;
    // room 1: ORANGE presses the right door; both go through it
    const door1x = truth1 ? 5 : -5;
    const s1 = p1
      ? [{ press: b1[truth1], until: () => R1.gatesN[truth1].passable }]
      : [{ x: door1x, z: R1.at(14.5), r: 1.0 }, { wait: () => R1.gatesN[truth1].passable }];
    const out1 = [{ x: door1x, z: R1.z1 - 2.5, r: 0.8 }];
    // room 2: ORANGE (reads) waits, TEAL presses the colours
    const s2 = p1
      ? [{ wait: () => R2.gatesN[0].passable, at: { x: 0, z: R2.at(9) } }]
      : need.map((ci, k) => ({ press: codeBtn[ci], until: () => cd.n > k }));
    const out2 = (rm, cx = 0) => [{ x: cx, z: rm.z1 - 2.5, r: 0.8 }];
    // room 3: each turns their own dials to the target (the bot knows both)
    const s3 = [0, 1, 2, 3].filter((i) => dialOwner[i] === me).map((i) => ({ press: dialBtn[i], until: () => dv[i] === dialT[i] }));
    // room 4: TEAL cuts, ORANGE waits
    const s4 = p1
      ? [{ wait: () => R4.gatesN[0].passable, at: { x: 0, z: R4.at(9) } }]
      : [0, 1, 2].map((r) => ({ press: cutBtn[solveWires(wires[r])], until: () => bomb.r > r }));
    // maze
    const lane = (L) => L;
    const mazeWalk = (patrols) => {
      const st = [];
      const go = (x, z, r = 0.8) => st.push({ x, z, r });
      go(XC(0), ZC(0)); go(XC(0), ZC(1));
      const cross = (L, dirx) => {
        const sx = L.cx - dirx * 3.0, ex = L.cx + dirx * 3.0;
        st.push({ x: sx, z: L.cz, r: 0.5, ok: patrols ? () => !mazeState.done ? freeFor(L, 1.5) : true : undefined });
        st.push({ x: ex, z: L.cz, r: 0.9 });
      };
      LANES.filter((L) => L.gr === 1).forEach((L) => cross(L, 1));
      go(XC(8), ZC(1)); go(XC(8), ZC(4));
      LANES.filter((L) => L.gr === 4).sort((a, b) => b.col - a.col).forEach((L) => cross(L, -1));
      go(XC(0), ZC(4)); go(XC(0), ZC(7));
      LANES.filter((L) => L.gr === 7).forEach((L) => cross(L, 1));
      go(XC(8), ZC(7));
      return st;
    };
    void lane;
    const toGate = [{ x: -16, z: zDiv + 3, r: 0.8 }];
    const mazeP2 = [
      ...toGate, { wait: () => entry.passable, at: { x: -16, z: zDiv + 3 } },
      ...mazeWalk(true),
      { press: shut, until: () => mazeState.done },
      { wait: () => MZ.gatesN[0].passable, at: { x: 16, z: ZC(8) + 0.4 } },
      { x: 16, z: zN - T - 1.6, r: 0.9 },
    ];
    const mazeP1 = [
      { x: 12.5, z: Zlob - 8, r: 0.6 },
      { wait: () => mazeState.done },
      { x: 9, z: Zlob - 8, r: 0.9 }, { x: 4.5, z: bdoor, r: 0.9 },
      { x: 4, z: Zlob - 6, r: 1.5 }, ...toGate, { wait: () => entry.passable },
      ...mazeWalk(false),
      { wait: () => MZ.gatesN[0].passable, at: { x: 16, z: ZC(8) + 0.4 } },
      { x: 16, z: zN - T - 1.6, r: 0.9 },
    ];
    // relay
    const s6 = [{ wait: () => bothIn.active }, { press: rbtn[side(me)], until: () => rl.lock[side(me)] || rl.ok, hold: () => rl.cnt[side(me)] >= rtgt(side(me)) }, { wait: () => rl.ok }];
    // doors 3: the bots know the exit
    const door7x = CX - 6.5 + exit7 * 6.5;
    const s7 = p1
      ? [{ press: b7[exit7], until: () => R7.gatesN[exit7].passable }]
      : [{ x: door7x, z: R7.at(14.5), r: 1.0 }, { wait: () => R7.gatesN[exit7].passable }];
    const out7 = [{ x: door7x, z: R7.z1 - 2.5, r: 0.8 }];
    bots(w, {
      p1: [...s1, ...out1, ...toRoom(R2, 0), ...s2, ...out2(R2), ...toRoom(R3, 0), ...s3, { wait: () => R3.gatesN[0].passable, at: { x: -4, z: R3.at(9) } }, ...out2(R3), ...toRoom(R4, 0), ...s4, ...out2(R4), { follow: true, until: () => pl().z < Zlob - 1.2 && pl().grounded }, ...mazeP1, ...toRoom(R6, CX), ...s6, ...out2(R6, CX), ...toRoom(R7, CX), ...s7, ...out7, { follow: true }],
      p2: [...s1, ...out1, ...toRoom(R2, 0), ...s2, ...out2(R2), ...toRoom(R3, 0), ...s3, { wait: () => R3.gatesN[0].passable, at: { x: 4, z: R3.at(9) } }, ...out2(R3), ...toRoom(R4, 0), ...s4, ...out2(R4), { follow: true, until: () => pl().z < Zlob - 1.2 && pl().grounded }, ...mazeP2, ...toRoom(R6, CX), ...s6, ...out2(R6, CX), ...toRoom(R7, CX), ...s7, ...out7, { follow: true }],
    });
    void goHere; void pass; void ST;
  },
};
