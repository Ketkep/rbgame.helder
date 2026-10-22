import * as THREE from 'three';
import { glowMaterial } from '../../engine/materials.js';
import { retreatEnv, deck, plate, gate, sign, lantern, lake, stage, botSteps, beacon, COL } from './kit.js';
import { canvasPlane, text, panelBg, glyph } from './communication-kit.js';
import { makeClock, beatTile, beatBar, liveBoard, noteTile, drawMeter, NOTE, mod } from './karaoke-night-kit.js';

// Session 13 — Karaoke Night. The world runs on a beat clock (a pure function of w.t, so both machines agree) and nothing is loud: every
// beat is a light, a bar or a board. Six numbers:
//   1 Warm-Up     a wave of tiles lights up on the beat; step on the next glow
//   2 Duet        orange tiles are solid on even beats and only for ORANGE, teal on odd beats and only for TEAL; a chord gate
//   3 Lyric Sheet only one of you can read the lyrics (colour + symbol per row); the other walks the field and trusts them. Then swap
//   4 Key Change  the tempo goes 60 -> 90 BPM mid-section, after a big countdown; another chord gate
//   5 Wrong Lyric the counsellor's lyric board lies once; the right notes breathe with the beat. Wrong notes drop away (quietly)
//   6 Hold Note   two arenas: both of you stand on your plate (it rides a moving platform) for several beats; a meter fills
// Tolerances: beat tiles are solid 0.2 s before and 0.25 s after their lit beat. Nothing relies on simultaneity under ~0.3 s.

const SPAWN_Z = 4;
const BPM0 = 60, BPM1 = 90;

export default {
  id: 'coop13',
  name: 'Karaoke Night',
  music: 'l1',
  deathRule: 'self',
  completeQuip: 'You hit every note. Roughly. The counsellor gives you a solid "performance".',
  titleCam: { center: [0, 2, -150], radius: 50, height: 22 },

  build(w, game) {
    retreatEnv(w, { mood: 'dusk' });
    lake(w, -30);
    const c = w.coop, me = c.me, N = c.names, P = c.partner;
    w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: SPAWN_Z, yaw: 0 };
    w.respawn = { ...w.spawn };
    const tell = (r, k, o) => c.tell(r, k, o);
    const clk = makeClock(w, c, BPM0);
    const rng = c.rng(13);
    const ri = (n) => Math.floor(rng() * n);
    const hexs = (n) => '#' + n.toString(16).padStart(6, '0');
    const cp = (x, z) => w.checkpoint({ x, y: 0, z, real: true });
    const mk = (zNorth, zSouth, ww, o = {}) => deck(w, { x: o.x ?? 0, y: 0, z: (zNorth + zSouth) / 2, w: ww, d: zNorth - zSouth, path: true, ...o });
    const lampPair = (z, x = 9) => { lantern(w, -x, 0, z); lantern(w, x, 0, z); };

    // ================================================================== 1. the warm-up ====================================
    mk(6, -14, 20);                                                                     // D0   z 6 … -14
    sign(w, 'SESSION 13 · KARAOKE NIGHT', 0, 10.8, SPAWN_Z - 20, { w: 14, h: 1.9 });
    lampPair(2); lampPair(-10);
    beatBar(w, clk, { x: 0, y: 7.6, z: -3 });
    sign(w, 'LIGHTS ON THE BEAT ARE SOLID. STEP ON THE NEXT ONE TO GLOW.', 0, 5.6, -12.5, { w: 11, h: 1.3, size: 34 });
    const warm = [];
    for (let j = 0; j < 7; j++) warm.push(beatTile(w, clk, { x: j % 2 ? 1.5 : -1.5, z: -17.5 - 5 * j, start: j, len: 2, cycle: 6, path: true }));
    sign(w, 'THE GLOW IS A BEAT AHEAD OF THE SOLID. YOU HAVE A QUARTER OF A SECOND.', 0, 5.6, -33, { w: 12, h: 1.3, size: 30 });
    mk(-51, -63, 20); cp(0, -57); lampPair(-55);                                         // D1   z -51 … -63
    stage(w, 'welcome', { x: 0, y: 1, z: 0, w: 20, h: 4, d: 8 }, () => { tell('p1', 'coop.l13.intro.p1', { priority: 2 }); tell('p2', 'coop.l13.intro.p2', { priority: 2 }); });
    stage(w, 'warm', { x: 0, y: 1, z: -12, w: 20, h: 4, d: 3 }, () => tell('all', 'coop.l13.warm'));
    stage(w, 'warmdone', { x: 0, y: 1, z: -54, w: 20, h: 4, d: 4 }, () => tell('all', 'coop.l13.warmdone'));

    // ================================================================== 2. the duet =======================================
    const duet = { p1: [], p2: [] };
    for (let j = 0; j < 5; j++) {
      const z = -66.5 - 5 * j;
      duet.p1.push(beatTile(w, clk, { x: -4.5, z, who: 'p1', start: 2 * j, len: 3, cycle: 8, path: 'p1' }));
      duet.p2.push(beatTile(w, clk, { x: 4.5, z, who: 'p2', start: 2 * j + 1, len: 3, cycle: 8, path: 'p2' }));
    }
    beatBar(w, clk, { x: 0, y: 7.6, z: -75 });
    sign(w, 'ORANGE TILES: EVEN BEATS · TEAL TILES: ODD BEATS', 0, 5.6, -76, { w: 12, h: 1.3, size: 32 });
    sign(w, 'ORANGE', -4.5, 3.6, -89.5, { w: 3.2, h: 0.8, border: hexs(COL.p1) }); sign(w, 'TEAL', 4.5, 3.6, -89.5, { w: 3.2, h: 0.8, border: hexs(COL.p2) });
    mk(-90, -110, 30); lampPair(-94, 13); lampPair(-106, 13);                           // D2   z -90 … -110
    const chord = (zPlate, zGate, deckW, tag) => {
      const g = gate(w, { x: 0, z: zGate, w: deckW, h: 5 });
      const door = { t: 0 };
      const pa = plate(w, { x: -6, y: 0, z: zPlate, need: 'p1', label: N.p1, hold: 0.8 });
      const pb = plate(w, { x: 6, y: 0, z: zPlate, need: 'p2', label: N.p2, hold: 0.8 });
      w.updaters.push((dt) => { door.t = pa.pressed && pb.pressed ? 9 : Math.max(0, door.t - dt); g.set(door.t > 0); });
      sign(w, 'CHORD: BOTH ON YOUR OWN COLOUR. THE GATE HOLDS NINE SECONDS.', 0, 6.8, zGate + 1.4, { w: 11, h: 1.3, size: 30 });
      return { g, pa, pb, door };
    };
    const ch1 = chord(-96, -103.5, 30, 'a');
    cp(0, -93);
    stage(w, 'duet', { x: 0, y: 1, z: -62, w: 20, h: 4, d: 3 }, () => tell('all', 'coop.l13.duet'));
    stage(w, 'chord', { x: 0, y: 1, z: -92, w: 30, h: 4, d: 3 }, () => tell('all', 'coop.l13.chord'));

    // ================================================================== 3. the lyric sheet ================================
    const L = { catX: 12, wallX: 6.2, rows: 4 };
    const seq = Array.from({ length: 8 }, () => ri(3));                                // the right note of every row
    const slot = [-3.2, 0, 3.2];
    const rows = [];
    const rowZ = (k) => (k < 4 ? -113.5 - 5 * k : -145.5 - 5 * (k - 4));
    for (let k = 0; k < 8; k++) {
      const perm = [0, 1, 2]; for (let i = 2; i > 0; i--) { const j = ri(i + 1); [perm[i], perm[j]] = [perm[j], perm[i]]; }
      const row = { k, z: rowZ(k), tiles: [] };
      perm.forEach((note, s) => row.tiles.push(noteTile(w, { x: slot[s], z: row.z, k: note, right: note === seq[k] })));
      row.good = row.tiles.find((t) => t.right);
      rows.push(row);
    }
    // field walls + catwalks (half 1: reader = p1 on the left; half 2: reader = p2 on the right)
    mk(-132, -142, 30); cp(0, -137); lampPair(-134, 13);                                  // M    z -132 … -142
    mk(-164, -176, 30); cp(0, -170); lampPair(-167, 13); lampPair(-173, 13);              // D3   z -164 … -176
    for (const [z0, z1] of [[-110, -132], [-142, -164]]) {
      const zc = (z0 + z1) / 2, dd = z0 - z1;
      for (const sx of [-1, 1]) {
        deck(w, { x: sx * L.catX, y: 0, z: zc, w: 3, d: dd, path: false });
        w.plat({ x: sx * L.wallX, y: 6, z: zc, w: 0.4, d: dd, h: 9, tex: 'wood', color: 0xd9c8a8 });
      }
    }
    const reader = (half) => (half === 0 ? 'p1' : 'p2');
    const lyricBoard = (half) => {
      const rd = reader(half), sx = half === 0 ? -1 : 1, zc = half === 0 ? -121 : -153;
      if (me === rd) {
        canvasPlane(w, { x: sx * 6.5, y: 3.1, z: zc, width: 12, height: 3.4, rotY: sx < 0 ? -Math.PI / 2 : Math.PI / 2, px: 1024, draw: (g, W, H) => {
          panelBg(g, W, H, hexs(COL[rd]), '#14161f');
          text(g, 'LYRIC SHEET · ONLY YOU CAN SEE THIS · CALL IT OUT, IN ORDER', W / 2, H * 0.13, 38, hexs(COL[rd]));
          for (let i = 0; i < 4; i++) {
            const n = NOTE[seq[half * 4 + i]], cx = W * (0.14 + 0.24 * i);
            text(g, 'ROW ' + (i + 1), cx, H * 0.3, 30, '#9aa0b0');
            glyph(g, seq[half * 4 + i], cx, H * 0.55, 56, n.css);
            text(g, n.name, cx, H * 0.84, 46, n.css);
          }
        } });
      } else {
        sign(w, 'ONLY ' + N[rd].toUpperCase() + ' CAN READ THE LYRICS. TRUST THEM.', sx * 5.95, 3.1, zc, { w: 9, h: 1.3, rotY: sx < 0 ? Math.PI / 2 : -Math.PI / 2, size: 34, border: hexs(COL[rd]) });
      }
    };
    lyricBoard(0); lyricBoard(1);
    sign(w, 'FIELD 1: ' + 'ORANGE READS, TEAL WALKS', 0, 5.4, -108.5, { w: 9, h: 1.1, size: 32, border: hexs(COL.p1) });
    sign(w, 'FIELD 2: TEAL READS, ORANGE WALKS', 0, 5.4, -140.5, { w: 9, h: 1.1, size: 32, border: hexs(COL.p2) });
    beatBar(w, clk, { x: 0, y: 7.6, z: -134 });
    stage(w, 'lyric1', { x: 0, y: 1, z: -108, w: 30, h: 4, d: 3 }, () => { tell('p1', 'coop.l13.lyric.read', { priority: 2 }); tell('p2', 'coop.l13.lyric.walk', { priority: 2 }); });
    stage(w, 'lyric2', { x: 0, y: 1, z: -135, w: 30, h: 4, d: 3 }, () => { tell('p2', 'coop.l13.lyric2.read', { priority: 2 }); tell('p1', 'coop.l13.lyric2.walk', { priority: 2 }); });
    stage(w, 'lyricdone', { x: 0, y: 1, z: -168, w: 30, h: 4, d: 3 }, () => tell('all', 'coop.l13.lyricdone'));

    // ================================================================== 4. the key change =================================
    const kc = [];
    for (let j = 0; j < 8; j++) kc.push(beatTile(w, clk, { x: j % 2 ? 2 : -2, z: -179.5 - 5 * j, start: 2 * j, len: 3, cycle: 8, hex: 0xff7ad9, path: true }));
    const kb = liveBoard(w, { x: 0, y: 8, z: -211, width: 13, height: 3.6, px: 832 });
    const kcState = () => {
      const pend = clk.pending, bpm = clk.bpm();
      if (pend && w.t < pend.at) return { key: 'c' + Math.ceil((pend.at - w.t) / clk.spb()), n: Math.ceil((pend.at - w.t) / clk.spb()) };
      return { key: bpm > 70 ? 'fast' : 'slow' };
    };
    const kbDraw = (s) => kb.show(s.key, (g, W, H) => {
      if (s.n) { text(g, 'KEY CHANGE', W / 2, H * 0.2, 56, '#ff7ad9'); text(g, String(s.n), W / 2, H * 0.58, 120, '#ffffff'); text(g, BPM0 + ' BPM  →  ' + BPM1 + ' BPM', W / 2, H * 0.88, 40, '#ffc83d'); }
      else if (s.key === 'fast') { text(g, BPM1 + ' BPM', W / 2, H * 0.4, 110, '#ffc83d'); text(g, 'FASTER. SAME TILES. KEEP STEPPING.', W / 2, H * 0.8, 36, '#9aa0b0', 'center', '400'); }
      else { text(g, 'THIS IS ' + BPM0 + ' BPM', W / 2, H * 0.35, 70, '#fff3d0'); text(g, 'THAT IS NOT GOING TO LAST', W / 2, H * 0.72, 40, '#9aa0b0', 'center', '400'); }
    });
    kbDraw({ key: 'slow' });
    w.updaters.push(() => kbDraw(kcState()));
    sign(w, 'THE BOARD AHEAD COUNTS YOU IN. THE TEMPO CHANGES WHEN IT HITS ZERO.', 0, 5.6, -178, { w: 12, h: 1.3, size: 30 });
    beatBar(w, clk, { x: 0, y: 7.6, z: -184 });
    c.onEvent('stage:kcgo', () => { if (c.isHost && !clk.pending) c.set('kc', { at: w.t + 4 * clk.spb(), bpm: BPM1 }); });
    stage(w, 'kcgo', { x: 0, y: 1, z: -190, w: 20, h: 6, d: 5 }, () => tell('all', 'coop.l13.kc'));
    stage(w, 'kcin', { x: 0, y: 1, z: -172, w: 30, h: 4, d: 3 }, () => tell('all', 'coop.l13.kcin'));
    mk(-218, -234, 20); cp(0, -222); lampPair(-220); lampPair(-232);                     // D4   z -218 … -234
    const ch2 = chord(-224, -231, 20, 'b');
    stage(w, 'kcdone', { x: 0, y: 1, z: -220, w: 20, h: 4, d: 3 }, () => tell('all', 'coop.l13.kcdone'));

    // ================================================================== 5. the wrong lyric ================================
    const t5 = Array.from({ length: 6 }, () => ri(3));                                 // the truth for the six rows
    const LIE = 4;                                                                     // the board gets this row wrong (verse 2, second note)
    const shown = t5.map((v, i) => (i === LIE ? (v + 1 + ri(2)) % 3 : v));
    const rows5 = [];
    const row5Z = (k) => (k < 3 ? -237.5 - 5 * k : -260.5 - 5 * (k - 3));
    for (let k = 0; k < 6; k++) {
      const perm = [0, 1, 2]; for (let i = 2; i > 0; i--) { const j = ri(i + 1); [perm[i], perm[j]] = [perm[j], perm[i]]; }
      const row = { k, z: row5Z(k), tiles: [] };
      perm.forEach((note, s) => row.tiles.push(noteTile(w, { x: slot[s], z: row.z, k: note, right: note === t5[k], pulse: true, clk })));
      row.good = row.tiles.find((t) => t.right);
      rows5.push(row);
    }
    mk(-251, -257, 20); cp(0, -254); lampPair(-254);                                     // M5   z -251 … -257
    mk(-274, -288, 20); cp(0, -281); lampPair(-277); lampPair(-285);                       // D5   z -274 … -288
    const verseBoard = (v) => canvasPlane(w, { x: 0, y: 7.6, z: v === 0 ? -235 : -255, width: 12, height: 3.2, px: 960, draw: (g, W, H) => {
      panelBg(g, W, H, '#ffc83d', '#14161f');
      text(g, `THE COUNSELLOR'S LYRICS · VERSE ${v + 1}`, W / 2, H * 0.14, 38, '#ffc83d');
      for (let i = 0; i < 3; i++) {
        const k = shown[v * 3 + i], n = NOTE[k], cx = W * (0.2 + 0.3 * i);
        glyph(g, k, cx, H * 0.5, 50, n.css);
        text(g, n.name, cx, H * 0.84, 42, n.css);
      }
    } });
    verseBoard(0); verseBoard(1);
    sign(w, 'THE RIGHT NOTE BREATHES WITH THE BEAT.', 0, 5.0, -236, { w: 9, h: 1.1, size: 30 });
    beatBar(w, clk, { x: 0, y: 9.7, z: -238 });
    stage(w, 'wl1', { x: 0, y: 1, z: -232, w: 20, h: 4, d: 3 }, () => tell('all', 'coop.l13.wl1'));
    stage(w, 'wl2', { x: 0, y: 1, z: -253, w: 20, h: 4, d: 3 }, () => tell('all', 'coop.l13.wl2'));
        stage(w, 'wldone', { x: 0, y: 1, z: -278, w: 20, h: 4, d: 3 }, () => tell('all', 'coop.l13.wldone'));

    // ================================================================== 6. hold the note ==================================
    const arenas = [];
    const arena = (zt, o) => {
      mk(zt, zt - 13.5, 14);
      const gt = gate(w, { x: 0, z: zt - 13.1, w: 14, h: 5, glow: 0xffc83d });
      const ents = {};
      for (const [who, sx] of [['p1', -1], ['p2', 1]]) {
        const ph = who === 'p1' ? 0 : Math.PI * 0.5;
        const plat = w.plat({ x: sx * 11.5, y: 0, z: zt - 6.5, w: 5, d: 5, h: 0.8, tex: 'grid', color: COL[who], trim: COL[who], moving: true, roughness: 0.3 });
        w.mover(plat, (t) => ({ z: o.amp * Math.sin((2 * Math.PI * clk.beat(t)) / o.per + ph) }));
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.12, 32), glowMaterial(COL[who], 1.1));
        pad.position.y = 0.46; plat.group.add(pad);
        const zn = c.zone({ x: sx * 11.5, y: 1.4, z: zt - 6.5, w: 3, h: 2.4, d: 3, need: who, shrink: 0.05 });
        w.updaters.push(() => { zn.body.setCenter(plat.body.x, plat.body.y + 1.4, plat.body.z); pad.material.color.setHex(COL[who]).multiplyScalar(zn.active ? 2.4 : 0.9 + 0.5 * (0.5 + 0.5 * Math.cos((clk.beat() % 1) * Math.PI * 2))); });
        ents[who] = { plat, zn };
      }
      const A = { zt, o, ents, gt, prog: 0, grace: 0, done: false, key: 'hold' + arenas.length, board: liveBoard(w, { x: 0, y: 7.2, z: zt - 12.3, width: 11, height: 3.2, px: 704 }) };
      const bps = () => 1 / clk.spb();
      const drawB = () => A.board.show(`${Math.floor(A.prog * 4)}|${A.done}|${ents.p1.zn.active}|${ents.p2.zn.active}`, (g, W, H) => {
        if (A.done) { drawMeter(g, W, H, 1, 'NOTE HELD', 'THE GATE IS OPEN', '#3ddc97'); return; }
        drawMeter(g, W, H, A.prog / o.need, `HOLD THE NOTE · ${o.need} BEATS`, `${N.p1} ${ents.p1.zn.active ? 'ON' : 'OFF'}  ·  ${N.p2} ${ents.p2.zn.active ? 'ON' : 'OFF'}`);
      });
      c.on(A.key, () => { A.done = true; A.gt.set(true); });
      w.updaters.push((dt) => {
        if (!A.done) {
          const both = ents.p1.zn.active && ents.p2.zn.active;
          if (both) { A.grace = 0.35; A.prog += dt * bps(); } else { A.grace -= dt; if (A.grace < 0) A.prog = Math.max(0, A.prog - dt * bps() * 0.5); }
          if (A.prog >= o.need) { A.done = true; c.set(A.key, true); }
        }
        drawB();
      });
      sign(w, 'ORANGE: LEFT PLATE · TEAL: RIGHT PLATE · THE PLATES MOVE WITH THE BEAT', 0, 5.2, zt - 1.2, { w: 12, h: 1.2, size: 28 });
      arenas.push(A);
      return A;
    };
    const A1 = arena(-290, { amp: 2.4, per: 12, need: 6 });                              // hub 1 z -287 … -300.5
    mk(-306, -314, 10); cp(0, -310);                                                      // bridge  z -306 … -314
    const A2 = arena(-318, { amp: 2.8, per: 8, need: 8 });                                // hub 2 z -316 … -329.5
    const GOALZ = -343;
    mk(-335, -351, 14); lampPair(-340, 5); lampPair(-346, 5);                             // goal deck
    w.goal({ x: 0, y: 0, z: GOALZ });
    sign(w, 'BOTH OF YOU. IN THE CIRCLE. TAKE A BOW.', 0, 5.6, GOALZ + 4.5, { w: 9, h: 1.3, size: 32 });
    beacon(w, 0, 0, GOALZ, 0xffe9a8, 20);
    beatBar(w, clk, { x: 0, y: 7.6, z: -287 });
    stage(w, 'hold1', { x: 0, y: 1, z: -289, w: 14, h: 4, d: 3 }, () => tell('all', 'coop.l13.hold1'));
    stage(w, 'hold2', { x: 0, y: 1, z: -316, w: 10, h: 4, d: 3 }, () => tell('all', 'coop.l13.hold2'));
    stage(w, 'bow', { x: 0, y: 1, z: -337, w: 14, h: 4, d: 3 }, () => tell('all', 'coop.l13.bow'));
    c.on(A1.key, () => tell('all', 'coop.l13.held1'));
    c.on(A2.key, () => tell('all', 'coop.l13.held2'));
    w.hooks.onPartnerDeath = () => { tell('all', 'coop.l13.partnerdown'); return true; };

    // ================================================================== scripted bots ====================================
    const you = () => game.player;
    // hop along a wave of beat tiles: wait on the previous one until the next is solid for long enough, then go
    const wave = (tiles, from) => tiles.flatMap((tl, j) => {
      const prev = j ? tiles[j - 1] : null;
      return [
        { x: prev ? prev.x : from.x, z: prev ? prev.z : from.z, r: 0.6, until: () => Math.hypot(you().x - (prev ? prev.x : from.x), you().z - (prev ? prev.z : from.z)) < 1.4 && tl.left() > 1.8 && (!prev || prev.left() > 0.8) },
        { x: tl.x, z: tl.z, r: 1.1 },
      ];
    });
    const walkField = (rws, pick) => rws.map((r) => ({ x: pick(r).x, z: pick(r).z, r: 1.1 }));
    const gateWait = (g) => ({ x: you().x, z: you().z, until: () => g.door.t > 2 });
    const common = (role) => [
      ...wave(warm, { x: 0, z: -12 }),
      { x: 0, z: -57, r: 2 },
      ...wave(duet[role], { x: role === 'p1' ? -4.5 : 4.5, z: -62 }),
      { x: role === 'p1' ? -6 : 6, z: -96, r: 0.7, until: () => ch1.g.passable },                // stand on my plate until the gate is up
    ];
    const afterField = (role) => [
      { x: 0, z: -170, r: 2 },
      ...wave(kc, { x: 0, z: -174.4 }),
      { x: 0, z: -222, r: 2 },
      { x: role === 'p1' ? -6 : 6, z: -224, r: 0.7, until: () => ch2.g.passable },
      { x: 0, z: -233, r: 2 },
      ...walkField(rows5.slice(0, 3), (r) => r.good),
      { x: 0, z: -254, r: 1.5 },
      ...walkField(rows5.slice(3), (r) => r.good),
      { x: 0, z: -281, r: 2 },
    ];
    const arenaSteps = (role, A) => {
      const plat = A.ents[role].plat, sx = role === 'p1' ? -1 : 1;
      return [
        { x: sx * 3, z: A.zt - 4, r: 1.5 },
        { x: () => sx * 11.5, z: () => plat.body.z, r: 0.9, until: () => A.done },
        { x: 0, z: A.zt - 11, r: 1.5 },
      ];
    };
    const finish = (role) => [
      ...arenaSteps(role, A1),
      { x: 0, z: -305, r: 1.5 }, { x: 0, z: -310, r: 1.5 },
      ...arenaSteps(role, A2),
      { x: 0, z: -334, r: 1.5 }, { x: 0, z: GOALZ, r: 1.2 },
    ];
    botSteps(w, {
      p1: [  // reader of field 1, walker of field 2
        ...common('p1'),
        { x: -12, z: -112, r: 1.2 }, { x: -12, z: -134, r: 1.5 }, { x: -12, z: -137, r: 1.5, until: () => P.has && P.sz < -133 },
        { x: 0, z: -137, r: 2 },
        ...walkField(rows.slice(4), (r) => r.good),
        ...afterField('p1'),
        ...finish('p1'),
      ],
      p2: [  // walker of field 1, reader of field 2
        ...common('p2'),
        { x: 0, z: -108, r: 1.5 },
        ...walkField(rows.slice(0, 4), (r) => r.good),
        { x: 0, z: -137, r: 2 },
        { x: 12, z: -144, r: 1.2 }, { x: 12, z: -162, r: 1.5 }, { x: 12, z: -166, r: 1.5, until: () => P.has && P.sz < -165 },
        ...afterField('p2'),
        ...finish('p2'),
      ],
    });
  },
};
