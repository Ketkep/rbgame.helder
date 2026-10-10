import * as THREE from 'three';
import { chain, spot } from '../common.js';
import { glowMaterial } from '../../engine/materials.js';
import { retreatEnv, deck, stone, plate, gate, riser, sign, lantern, lake, stage, botSteps, beacon, COL } from './kit.js';
import { liveSign, pedestal, localMark, leapfrog } from './newlywed-kit.js';

// Session 6 — The Newlywed Game. A game show about each other, with a counsellor who lies for fun.
// Eight beats, alternating short platform courses and rounds:
//   1 reception + course            2 KNOW YOUR PARTNER (answer / guess; matches open the gate, a mismatch earns the make-up course)
//   3 backstage leapfrog             4 WHISPER BOOTH (the counsellor tells each of you what your partner "said"; sometimes true)
//   5 SPLIT OR STEAL (prisoner's dilemma; or the trust-free joint challenge down the middle)
//   6 BLIND DATE (a wall hides your partner; talk them across a floor of hidden tiles; then swap)
//   7 LIGHTNING ROUND (six buzzers, alternating, one clock)       8 the grand prize (fake) and the real one (needs both)
// Death rule 'self'. Night, spotlights, applause that never comes.

const OTHER = { p1: 'p2', p2: 'p1' };
const Q = [
  { q: 'FAVOURITE COLOUR', s: 'Colour', o: ['Red', 'Blue', 'Green', 'Yellow'] },
  { q: 'HOW DO YOU SLEEP?', s: 'Sleep', o: ['Early bird', 'Night owl', 'Napper', 'Starfish'] },
  { q: 'WORST HABIT', s: 'Habit', o: ['Running late', 'Mess', 'Snacking', 'Phone'] },
  { q: 'PIZZA TOPPING', s: 'Pizza', o: ['Plain cheese', 'Pineapple', 'Mushroom', 'Everything'] },
];
const NEED = 3;                                              // correct guesses (of 8) that open the gate
const WH = [
  { q: 'THE LAST BISCUIT', o: ['SHARE IT', 'KEEP IT'] },
  { q: 'THE HOLIDAY PRIZE', o: ['SHARE IT', 'KEEP IT'] },
  { q: 'NEXT ROUND: SPLIT OR STEAL?', o: ['SPLIT', 'STEAL'] },
];
const LETTERS = ['A', 'B', 'C', 'D'];

export default {
  id: 'coop6',
  name: 'The Newlywed Game',
  music: 'l1',
  deathRule: 'self',
  completeQuip: 'Eight rounds. Several lies. One prize, and it was never a car.',
  titleCam: { center: [0, 2, -60], radius: 30, height: 12 },

  build(w, game) {
    retreatEnv(w, { mood: 'night' });
    lake(w, -30, 900, 0x1b3d57);
    const c = w.coop, me = c.me, N = c.names, P = c.partner;
    const tell = (r, k, o) => c.tell(r, k, o);
    const ROLES2 = ['p1', 'p2'];
    const roleCss = (r) => '#' + COL[r].toString(16).padStart(6, '0');
    const dsign = (text, x, y, z, o) => sign(w, text, x, y, z, o);
    w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    const flat = (text, x, y, z, o = {}) => w.sign({ text, x, y, z, w: o.w ?? 2, h: o.h ?? 2, rotX: -Math.PI / 2, rotY: o.rotY ?? 0, glow: true, color: o.color ?? '#fff3d0', bg: o.bg ?? null, border: o.border ?? null, tw: o.tw ?? 256, size: o.size ?? 0 });
    // a plain strip of platforms along -Z that is NOT on the bots' default path
    const strip = (x, y, z0, specs) => {
      let z = z0; const out = [];
      for (const s of specs) { z -= s.gap; y += s.dy ?? 0; const d = s.d ?? 4; out.push(deck(w, { x: s.x ?? x, y, z: z - d / 2, w: s.w ?? 5, d })); z -= d; }
      out.endZ = z; out.endY = y; return out;
    };
    const wall = (o) => stone(w, { color: 0x2a2f3d, ...o });

    // ============================================================ 1. reception + the first course ==========
    deck(w, { x: 0, y: 0, z: -4, w: 22, d: 20, path: true, trim: 0xffc83d });              // z 6 … -14
    dsign('THE NEWLYWED GAME', 0, 5.4, 4, { w: 12, h: 1.8, border: '#ff4d5e' });
    dsign('SESSION 6 · LIVE FROM SERENITY FALLS', 0, 3.7, 4, { w: 10, h: 0.9, border: '#39d7c9' });
    for (const lx of [-9, 9]) { lantern(w, lx, 0, 2); lantern(w, lx, 0, -12); }
    spot(w, { x: -8, y: 12, z: 0, tx: -2, ty: 0, tz: -6, color: 0xffe0b0, r: 3.6, opacity: 0.07 });
    spot(w, { x: 8, y: 12, z: 0, tx: 2, ty: 0, tz: -6, color: 0xb0e0ff, r: 3.6, opacity: 0.07 });
    const A = chain(w, { x: 0, y: 0, z: -14 }, [
      { gap: 2.4, d: 5, w: 6 }, { gap: 2.8, d: 4, w: 4, dy: 0.6 }, { gap: 3.0, d: 4, w: 4, dy: -0.6 },
      { gap: 2.6, d: 4, w: 5 }, { gap: 3.2, d: 4, w: 3.6 }, { gap: 2.8, d: 5, w: 6 },
    ]);
    w.crumble(A[1], { delay: 1.3, gone: 3.5 }); w.crumble(A[4], { delay: 1.3, gone: 3.5 });
    w.checkpoint({ x: 0, y: A[3].top, z: A[3].body.z, real: true });
    stage(w, 'welcome', { x: 0, y: 1, z: 2, w: 22, h: 4, d: 8 }, () => { tell('p1', 'coop.l6.intro.p1', { priority: 2 }); tell('p2', 'coop.l6.intro.p2', { priority: 2 }); });
    stage(w, 'course1', { x: 0, y: 1, z: -15, w: 8, h: 4, d: 3 }, () => tell('all', 'coop.l6.course1'));

    // ============================================================ 2. KNOW YOUR PARTNER =====================
    const zN = A.endZ - 2.8;                                  // near edge of studio 1
    const zS = zN - 15;
    deck(w, { x: 0, y: 0, z: zS, w: 42, d: 30, path: true, trim: 0xff4d5e });
    const bz = zN - 9;                                        // button row
    const bx = { p1: -13, p2: 13 };
    const qKey = (kind, role, qi) => `${kind}:${role}:${qi}`;
    const getv = (k) => c.get(k, -1);
    const qState = () => {
      for (let qi = 0; qi < Q.length; qi++) {
        const sDone = getv(qKey('s', 'p1', qi)) >= 0 && getv(qKey('s', 'p2', qi)) >= 0;
        const gDone = getv(qKey('g', 'p1', qi)) >= 0 && getv(qKey('g', 'p2', qi)) >= 0;
        if (!gDone) return { qi, phase: sDone ? 'guess' : 'self' };
      }
      return { qi: Q.length, phase: 'done' };
    };
    const pressQ = (i) => {
      const st = qState(); if (st.phase === 'done') return;
      const k = qKey(st.phase === 'self' ? 's' : 'g', me, st.qi);
      if (getv(k) >= 0) return;
      c.set(k, i); game.ui.toast?.('Locked in. No take-backs.', 'gold');
    };
    const qPed = {}, qBoard = {};
    for (const r of ROLES2) {
      qPed[r] = Q[0].o.map((_, i) => pedestal(w, { x: bx[r] + (i - 1.5) * 2.4, z: bz, role: r, color: COL[r], label: '', onPress: () => pressQ(i), signW: 2.3 }));
      qBoard[r] = liveSign(w, { x: bx[r], y: 5.6, z: bz - 1, w: 9.5, h: 2.8, tw: 768, border: roleCss(r) });
      flat(`${N[r]}'S BOOTH`.toUpperCase(), bx[r], 0.05, bz + 2.4, { w: 6, h: 1.2, tw: 512, border: roleCss(r) });
      spot(w, { x: bx[r], y: 12, z: bz + 3, tx: bx[r], ty: 0, tz: bz, color: r === 'p1' ? 0xffc890 : 0x90f0e8, r: 4, opacity: 0.08 });
    }
    const board1 = liveSign(w, { x: 0, y: 5.8, z: zN - 21, w: 19, h: 8, tw: 1024, border: '#ff4d5e', align: 'left' });
    dsign('ANSWER ABOUT YOURSELF · THEN GUESS THEIR ANSWER · NO PEEKING', 0, 8.8, zN - 21, { w: 14, h: 1.1, size: 30 });
    const gate1 = gate(w, { x: 0, y: 0, z: zN - 29.6, w: 42, h: 6, glow: 0xff4d5e });
    const bypassUp = riser(w, { x: -23, y: 0, z: zN - 12, w: 4, d: 6, h: 0.6, drop: 6, color: 0xe8b0b0, trim: 0xff4d5e, speed: 6 });
    deck(w, { x: -28, y: 0, z: zN - 12, w: 6, d: 6, trim: 0xff4d5e });
    flat('MAKE-UP COURSE', -28, 0.05, zN - 12, { w: 5, h: 1.4, tw: 512, border: '#ff4d5e' });
    const BY = strip(-28, 0, zN - 15, [{ gap: 2.8, d: 4, w: 5 }, { gap: 3.0, d: 4, w: 4, dy: 0.6 }, { gap: 3.2, d: 4, w: 4, dy: 0 }, { gap: 3.0, d: 4, w: 3.8, dy: -0.6 }]);
    w.crumble(BY[1], { delay: 1.2, gone: 3.5 });
    deck(w, { x: -23, y: 0, z: BY[3].body.z, w: 4, d: 4 });                                   // connector onto the backstage deck
    dsign('THE MAKE-UP COURSE\n(YOU KNOW WHAT YOU DID)', -28, 4.4, zN - 12, { w: 6, h: 1.6, border: '#ff4d5e' });
    stage(w, 'r1', { x: 0, y: 1, z: zN - 3, w: 42, h: 4, d: 5 }, () => tell('all', 'coop.l6.r1.intro'));
    let r1Done = false;
    w.updaters.push(() => {
      const st = qState(), qi = Math.min(st.qi, Q.length - 1), q = Q[qi];
      for (const r of ROLES2) {
        const kind = st.phase === 'self' ? 's' : 'g';
        const locked = st.phase !== 'done' && getv(qKey(kind, r, qi)) >= 0;
        let head;
        if (st.phase === 'done') head = 'ALL DONE\nSEE THE BOARD';
        else if (st.phase === 'self') head = `Q${qi + 1}/${Q.length} · ${q.q}\nANSWER FOR YOURSELF`;
        else head = `Q${qi + 1}/${Q.length} · ${q.q}\nGUESS ${N[OTHER[r]].toUpperCase()}'S ANSWER`;
        qBoard[r].set(head + (locked ? '\nLOCKED IN ✔' : st.phase === 'done' ? '' : (r === me ? '\nPICK ONE' : '\nthinking…')), { border: locked ? '#3ddc97' : roleCss(r) });
        qPed[r].forEach((pd, i) => { pd.label(st.phase === 'done' ? '—' : q.o[i]); pd.lit(!locked && st.phase !== 'done'); });
      }
      const lines = ['KNOW YOUR PARTNER', ''];
      let matches = 0;
      for (let k = 0; k < Math.min(st.qi, Q.length); k++) {
        const a1 = Q[k].o[getv(qKey('s', 'p1', k))], a2 = Q[k].o[getv(qKey('s', 'p2', k))];
        const g1 = Q[k].o[getv(qKey('g', 'p1', k))], g2 = Q[k].o[getv(qKey('g', 'p2', k))];
        const ok1 = g1 === a2, ok2 = g2 === a1;
        matches += (ok1 ? 1 : 0) + (ok2 ? 1 : 0);
        lines.push(`${k + 1} ${Q[k].s}: ${N.p1} = ${a1}  ·  ${N.p2} guessed ${g2} ${ok2 ? '✔' : '✘'}`);
        lines.push(`    ${N.p2} = ${a2}  ·  ${N.p1} guessed ${g1} ${ok1 ? '✔' : '✘'}`);
      }
      if (st.qi === 0) lines.push('(answers appear here once you have both guessed)');
      if (st.phase === 'done') { lines.push(''); lines.push(matches >= NEED ? `${matches}/${Q.length * 2} RIGHT · THE GATE OPENS` : `${matches}/${Q.length * 2} RIGHT · NEED ${NEED} · THE GATE STAYS SHUT`); }
      board1.set(lines.join('\n'), { border: st.phase === 'done' ? (matches >= NEED ? '#3ddc97' : '#ff4d5e') : '#ff4d5e' });
      if (st.phase === 'done') {
        gate1.set(matches >= NEED); bypassUp.set(matches < NEED);
        if (!r1Done) {
          r1Done = true;
          tell('all', matches >= Q.length * 2 ? 'coop.l6.r1.perfect' : matches >= NEED ? 'coop.l6.r1.pass' : 'coop.l6.r1.fail', { priority: 2 });
        }
      }
    });

    // ============================================================ 3. backstage: hold the curtain ===========
    const zB0 = zN - 30;
    deck(w, { x: 0, y: 0, z: zB0 - 10, w: 42, d: 20, path: true });                     // z zB0 … zB0-20
    w.checkpoint({ x: 0, y: 0, z: zB0 - 10, real: true });
    dsign('BACKSTAGE', 0, 4.6, zB0 - 3, { w: 6, h: 1.2 });
    const zI0 = zB0 - 24;
    const LF = leapfrog(w, { ox: 0, ys: 0, islands: [zI0, zI0 - 16, zI0 - 32], first: 'p1', iw: 8, id: 8 });
    stage(w, 'backstage', { x: 0, y: 1, z: zB0 - 6, w: 20, h: 4, d: 5 }, () => tell('all', 'coop.l6.backstage'));
    stage(w, 'islands', { x: 0, y: 1, z: zI0, w: 8, h: 4, d: 4 }, () => tell('all', 'coop.l6.islands'));
    const zD = zI0 - 36;                                                               // near edge of the whisper studio

    // ============================================================ 4. the WHISPER BOOTH ====================
    deck(w, { x: 0, y: 0, z: zD - 13, w: 42, d: 26, path: true, trim: 0x8b6cff });
    w.checkpoint({ x: 0, y: 0, z: zD - 4, real: true });
    const wz = zD - 8;
    const lieBit = c.rng(31)() < 0.5;
    const LIE = { p1: [1, 0, lieBit ? 1 : 0], p2: [0, 1, lieBit ? 0 : 1] };           // does the counsellor lie to <role> in round <ri>?
    const wKey = (r, ri) => `w:${r}:${ri}`;
    const wState = () => { for (let ri = 0; ri < WH.length; ri++) if (getv(wKey('p1', ri)) < 0 || getv(wKey('p2', ri)) < 0) return ri; return WH.length; };
    const pressW = (i) => { const ri = wState(); if (ri >= WH.length || getv(wKey(me, ri)) >= 0) return; c.set(wKey(me, ri), i); game.ui.toast?.('Whispered. The counsellor heard.', 'gold'); };
    const wPed = {}, wBoard = {};
    for (const r of ROLES2) {
      wPed[r] = [0, 1].map((i) => pedestal(w, { x: bx[r] + (i - 0.5) * 3.4, z: wz, role: r, color: i ? 0xff4d5e : 0x3ddc97, label: '', onPress: () => pressW(i), signW: 3 }));
      wBoard[r] = liveSign(w, { x: bx[r], y: 5.2, z: wz - 1, w: 9, h: 2.6, tw: 768, border: roleCss(r) });
      flat(`${N[r]}'S BOOTH`.toUpperCase(), bx[r], 0.05, wz + 2.4, { w: 6, h: 1.2, tw: 512, border: roleCss(r) });
    }
    const board2 = liveSign(w, { x: 0, y: 5.6, z: zD - 19, w: 19, h: 7, tw: 1024, border: '#8b6cff', align: 'left' });
    dsign('THE COUNSELLOR WHISPERS. THE COUNSELLOR IS NOT A PRIMARY SOURCE.', 0, 9.5, zD - 19, { w: 15, h: 1.1, size: 28, border: '#8b6cff' });
    const gate2 = gate(w, { x: 0, y: 0, z: zD - 25.6, w: 42, h: 6, glow: 0x8b6cff });
    const whispered = [false, false, false], revealAt = [Infinity, Infinity, Infinity];
    const told = (r, ri) => { const d = getv(wKey(OTHER[r], ri)); return LIE[r][ri] ? 1 - d : d; };      // what the counsellor says the partner said
    stage(w, 'whisper', { x: 0, y: 1, z: zD - 3, w: 42, h: 4, d: 5 }, () => tell('all', 'coop.l6.whisper.intro'));
    let whisperDone = false;
    w.updaters.push(() => {
      const ri = wState(), q = WH[Math.min(ri, WH.length - 1)];
      for (const r of ROLES2) {
        const locked = ri < WH.length && getv(wKey(r, ri)) >= 0;
        const head = ri >= WH.length ? 'ALL WHISPERED OUT' : `ROUND ${ri + 1}/${WH.length}\n${q.q}`;
        wBoard[r].set(head + (ri >= WH.length ? '' : locked ? '\nWHISPERED ✔' : (r === me ? '\nWHAT DO YOU TELL ME?' : '\nthinking…')), { border: locked ? '#3ddc97' : roleCss(r) });
        wPed[r].forEach((pd, i) => { pd.label(q.o[i]); pd.lit(!locked && ri < WH.length); });
      }
      for (let k = 0; k < WH.length; k++) {
        if (whispered[k] || getv(wKey('p1', k)) < 0 || getv(wKey('p2', k)) < 0) continue;
        whispered[k] = true; revealAt[k] = w.t + 7;
        tell(me, 'coop.l6.whisper', { priority: 2, vars: { claim: WH[k].o[told(me, k)], who: N[OTHER[me]] } });
        w.after(7, () => tell(me, 'coop.l6.whisper.reveal', { priority: 1 }));
      }
      const lines = ['THE TRUTH ABOUT WHAT YOU SAID', ''];
      for (let k = 0; k < WH.length; k++) {
        if (w.t < revealAt[k]) continue;
        lines.push(`${k + 1} ${WH[k].q}`);
        lines.push(`   ${N.p1}: ${WH[k].o[getv(wKey('p1', k))]}   ·   ${N.p2}: ${WH[k].o[getv(wKey('p2', k))]}`);
        lines.push(`   told ${N.p1} "${WH[k].o[told('p1', k)]}" → ${LIE.p1[k] ? 'A LIE' : 'true'}   ·   told ${N.p2} "${WH[k].o[told('p2', k)]}" → ${LIE.p2[k] ? 'A LIE' : 'true'}`);
      }
      if (lines.length === 2) lines.push('(each round is revealed a few seconds after you both whisper)');
      const done = w.t >= revealAt[WH.length - 1];
      if (done) { lines.push(''); lines.push('THE COUNSELLOR LIES. NOW YOU HAVE THE RECEIPTS.'); }
      board2.set(lines.join('\n'));
      gate2.set(done);
      if (done && !whisperDone) { whisperDone = true; tell('all', 'coop.l6.whisper.done'); }
    });

    // ============================================================ 5. SPLIT OR STEAL ========================
    const zH0 = zD - 26;
    const ZH1 = zH0 - 26;
    deck(w, { x: 0, y: 0, z: zH0 - 13, w: 68, d: 26, path: true, trim: 0xffc83d });
    w.checkpoint({ x: 0, y: 0, z: zH0 - 4, real: true });
    const hz = zH0 - 9;
    const sosKey = (r) => 'sos:' + r;
    const pressSos = (v) => { if (c.get(sosKey(me), null)) return; c.set(sosKey(me), v); game.ui.toast?.('Locked in. Quietly.', 'gold'); };
    const exits = () => {
      const a = c.get(sosKey('p1'), null), b = c.get(sosKey('p2'), null);
      if (!a || !b) return null;
      if (a === 'split' && b === 'split') return { p1: 1, p2: 1, kind: 'split' };
      if (a === 'steal' && b === 'split') return { p1: 0, p2: 3, kind: 'p1' };
      if (a === 'split' && b === 'steal') return { p1: 3, p2: 0, kind: 'p2' };
      return { p1: 4, p2: 4, kind: 'steal' };
    };
    const sPed = {}, sBoard = {};
    for (const r of ROLES2) {
      sPed[r] = ['split', 'steal'].map((v, i) => pedestal(w, { x: bx[r] + (i - 0.5) * 3.4, z: hz, role: r, color: i ? 0xff4d5e : 0x3ddc97, label: v.toUpperCase(), onPress: () => pressSos(v), signW: 3 }));
      sBoard[r] = liveSign(w, { x: bx[r], y: 5.2, z: hz - 1, w: 9, h: 2.6, tw: 768, border: roleCss(r) });
      flat(`${N[r]}'S BOOTH`.toUpperCase(), bx[r], 0.05, hz + 2.4, { w: 6, h: 1.2, tw: 512, border: roleCss(r) });
    }
    const board3 = liveSign(w, { x: 0, y: 5.8, z: zH0 - 6.5, w: 15, h: 6.6, tw: 1024, border: '#ffc83d' });
    dsign('NO TRUST REQUIRED ▸ THE HARD WAY, TOGETHER ▸', 0, 4.2, ZH1 + 1.2, { w: 11, h: 1.3, size: 34, border: '#3ddc97' });
    dsign('◂ YOUR OWN LANE ◂', -22, 4.2, ZH1 + 1.2, { w: 8, h: 1.1, size: 34, border: roleCss('p1') });
    dsign('▸ YOUR OWN LANE ▸', 22, 4.2, ZH1 + 1.2, { w: 8, h: 1.1, size: 34, border: roleCss('p2') });
    stage(w, 'sos', { x: 0, y: 1, z: zH0 - 3, w: 68, h: 4, d: 5 }, () => tell('all', 'coop.l6.sos.intro'));
    stage(w, 'central', { x: 0, y: 1, z: ZH1 - 3, w: 8, h: 4, d: 4 }, () => tell('all', 'coop.l6.sos.central'));
    // --- the lanes: four blocks each; the exit you were given decides where the bridge to the catwalk stands
    const BL = [
      { gaps: [2.6, 3.0, 2.6], ws: [6, 5, 6], cr: -1 },
      { gaps: [3.0, 3.2, 2.6], ws: [5, 4, 6], cr: 1 },
      { gaps: [3.2, 3.4, 2.6], ws: [4, 4, 6], cr: 1 },
      { gaps: [3.4, 3.4, 2.6], ws: [4, 3.6, 6], cr: 1 },
    ];
    const DS = [4, 4, 6];
    const laneC = { p1: [], p2: [] };                          // [block][plat] -> {x,z}
    const XL = 22, XC = 11, XR = 15.85;                        // lane x, catwalk x, riser x (all × side)
    let ZM = ZH1;
    const RX = { p1: {}, p2: {} };
    const sideOf = (r) => (r === 'p1' ? -1 : 1);
    for (const r of ROLES2) {
      const s = sideOf(r); let z = ZH1;
      BL.forEach((b, k) => {
        const row = [];
        for (let j = 0; j < 3; j++) {
          z -= b.gaps[j];
          const p = deck(w, { x: s * XL, y: 0, z: z - DS[j] / 2, w: b.ws[j], d: DS[j], trim: COL[r] });
          if (j === b.cr) w.crumble(p, { delay: 1.2, gone: 3.5 });
          row.push({ x: s * XL, z: z - DS[j] / 2 });
          z -= DS[j];
        }
        laneC[r].push(row);
        const jz = row[2].z;
        if (r === me && k < 3) localMark(w, s * XL, 0, jz, { w: 5, d: 5 });
        if (k === 0 || k === 2) RX[r][k + 1] = riser(w, { x: s * XR, y: 0, z: jz, w: 6.3, d: 6, h: 0.6, drop: 6, color: 0xe8d6a8, trim: COL[r], speed: 6 });
      });
      ZM = z;
      RX[r][0] = riser(w, { x: s * XC, y: 0, z: ZH1 - 3.1, w: 3.4, d: 6.2, h: 0.6, drop: 6, color: 0xe8d6a8, trim: COL[r], speed: 6 });
      const cwTop = ZH1 - 6.2, cwLen = cwTop - ZM;
      deck(w, { x: s * XC, y: 0, z: (cwTop + ZM) / 2, w: 3.4, d: cwLen, trim: COL[r] });
      flat(r === me ? 'YOUR EXIT' : "THEIR EXIT", s * XC, 0.05, cwTop - 3, { w: 2.6, h: 1, tw: 256, border: roleCss(r) });
    }
    for (const r of ROLES2) {
      const s = sideOf(r), jz = laneC[r].map((b) => b[2].z);
      dsign('SHORTCUT', s * XC, 3.6, ZH1 - 3.1, { w: 3.6, h: 0.8, size: 30, border: '#ff4d5e' });
      dsign('1 ROUND', s * XR, 3.6, jz[0], { w: 3.6, h: 0.8, size: 30, border: '#3ddc97' });
      dsign('3 ROUNDS', s * XR, 3.6, jz[2], { w: 3.6, h: 0.8, size: 30, border: '#ffc83d' });
    }
    // central, trust-free lane
    const CI = [0, 1, 2, 3, 4].map((j) => ZH1 - 4 - 16 * j);
    const CL = leapfrog(w, { ox: 0, ys: 0, islands: CI, first: 'p2', iw: 8, id: 8, path: false });
    for (const z of CI.slice(1)) localMark(w, 0, 0, z, { w: 6, d: 6 });
    deck(w, { x: 0, y: 0, z: (CI[4] - 4 + ZM) / 2, w: 8, d: CI[4] - 4 - ZM });
    // the merge hall
    deck(w, { x: 0, y: 0, z: ZM - 12, w: 68, d: 24, path: true, trim: 0x39d7c9 });
    w.checkpoint({ x: 0, y: 0, z: ZM - 6, real: true });
    dsign('FULL CIRCLE', 0, 4.6, ZM - 3, { w: 7, h: 1.2, border: '#39d7c9' });
    stage(w, 'merge', { x: 0, y: 1, z: ZM - 4, w: 68, h: 4, d: 4 }, () => tell('all', 'coop.l6.sos.merge'));
    let sosAnnounced = false;
    w.updaters.push(() => {
      const ex = exits();
      for (const r of ROLES2) {
        const mine = c.get(sosKey(r), null);
        sBoard[r].set(`SPLIT OR STEAL\n${mine ? 'LOCKED IN ✔' : (r === me ? 'CHOOSE. QUIETLY.' : 'thinking…')}`, { border: mine ? '#3ddc97' : roleCss(r) });
        sPed[r].forEach((pd) => pd.lit(!mine));
        for (const k of [0, 1, 3]) RX[r][k]?.set(!!ex && ex[r] === k);
      }
      const rn = (e) => (e === 0 ? 'SHORTCUT' : e === 1 ? 'EXPRESS' : e === 3 ? 'THE LONG WAY' : 'THE LONGEST WAY');
      let txt;
      if (!ex) txt = 'SPLIT OR STEAL\n\nBOTH SPLIT: both get the express\nONE STEALS: thief gets the shortcut,\nthe other gets the long way\nBOTH STEAL: you both get the longest way\n\nOr: the middle lane. No trust. Just work.';
      else txt = `${N.p1}: ${c.get(sosKey('p1')).toUpperCase()}   ·   ${N.p2}: ${c.get(sosKey('p2')).toUpperCase()}\n\n${N.p1} → ${rn(ex.p1)}\n${N.p2} → ${rn(ex.p2)}\n\nYOUR EXIT IS THE BRIDGE THAT RISES`;
      board3.set(txt, { border: ex ? '#ff4d5e' : '#ffc83d' });
      if (ex && !sosAnnounced) {
        sosAnnounced = true;
        if (ex.kind === 'split') tell('all', 'coop.l6.sos.split', { priority: 2 });
        else if (ex.kind === 'steal') tell('all', 'coop.l6.sos.steal', { priority: 2 });
        else { tell(ex.kind, 'coop.l6.sos.thief', { priority: 2 }); tell(OTHER[ex.kind], 'coop.l6.sos.victim', { priority: 2 }); }
      }
    });

    // ============================================================ 6. BLIND DATE ============================
    const zF = ZM - 24;
    deck(w, { x: 0, y: 0, z: zF - 6, w: 44, d: 12, path: true, trim: 0xff7ab8 });                 // z zF … zF-12
    const zRow = (z0, k) => z0 - 12 - 3.0 - k * 4.4;
    const XC4 = [0, 1, 2, 3].map((j) => (j - 1.5) * 3.6);
    const mkField = (idx, z0, walker, guide, side) => {
      const rng = c.rng(60 + idx); let cur = Math.floor(rng() * 4); const safe = [];
      for (let k = 0; k < 6; k++) { safe.push(cur); cur = Math.max(0, Math.min(3, cur + Math.floor(rng() * 3) - 1)); }
      for (let k = 0; k < 6; k++) {
        for (let j = 0; j < 4; j++) {
          const p = deck(w, { x: XC4[j], y: 0, z: zRow(z0, k), w: 3.0, d: 3.0, trim: COL[walker], color: 0xc9b99a });
          if (j !== safe[k]) w.crumble(p, { delay: 0.18, gone: 3.0 });
          flat(LETTERS[j], XC4[j], 0.04, zRow(z0, k), { w: 1.6, h: 1.6, color: '#3a2c20', tw: 128 });
        }
        dsign(`ROW ${k + 1}`, -side * 8.6, 1.5, zRow(z0, k), { w: 2.4, h: 0.8, size: 30 });
      }
      const zEnd = zRow(z0, 5) - 1.5;
      // the wall that hides your partner, and the balcony behind it
      wall({ x: side * 9.5, y: 9, z: (z0 - 12 + zEnd - 1.5) / 2, w: 1, d: z0 - 12 - zEnd + 1.5, h: 9 });
      deck(w, { x: side * 16, y: 0, z: (z0 - 12 + zEnd - 1.5) / 2, w: 8, d: z0 - 12 - zEnd + 1.5, trim: COL[guide] });
      if (me === guide) {
        const mp = liveSign(w, { x: side * 10.7, y: 4.6, z: (z0 - 12 + zEnd) / 2, w: 9, h: 6.4, rotY: side * Math.PI / 2, tw: 768, border: roleCss(guide), align: 'left', size: 40 });
        mp.set('THE SAFE ROUTE\n(YOU CAN SEE IT. THEY CANNOT SEE YOU.)\n' + safe.map((s, k) => `ROW ${k + 1}   ▸   ${LETTERS[s]}`).join('\n') + '\n\nLeft to right as THEY walk forward: A B C D');
      } else {
        dsign('NO MAP FOR YOU.\nYOUR PARTNER HAS ONE. LISTEN.', 0, 3.6, z0 - 12 - 1.2, { w: 9, h: 1.7, size: 36, border: roleCss(guide) });
      }
      dsign('WRONG TILES DROP. THE MAP IS ON THE OTHER SIDE OF THE WALL.', side * 9.5, 10.6, (z0 - 12 + zEnd) / 2, { w: 12, h: 1, size: 28, rotY: 0 });
      localMark(w, 0, 0, z0 - 9, { w: 40, d: 4 });
      return { safe, zEnd };
    };
    const FA = mkField(0, zF, 'p1', 'p2', 1);
    const zSw = FA.zEnd - 1.5;                                 // swap deck near edge
    deck(w, { x: 0, y: 0, z: zSw - 6, w: 44, d: 12, path: true, trim: 0xff7ab8 });
    w.checkpoint({ x: 0, y: 0, z: zSw - 6, real: true });
    const FB = mkField(1, zSw, 'p2', 'p1', -1);
    const zG0 = FB.zEnd - 1.5;
    stage(w, 'blind', { x: 0, y: 1, z: zF - 3, w: 44, h: 4, d: 5 }, () => { tell('all', 'coop.l6.blind.intro'); });
    stage(w, 'blind1', { x: 0, y: 1, z: zF - 9, w: 44, h: 4, d: 3 }, () => { tell('p1', 'coop.l6.blind.walker'); tell('p2', 'coop.l6.blind.guide'); });
    stage(w, 'swap', { x: 0, y: 1, z: zSw - 4, w: 44, h: 4, d: 4 }, () => tell('all', 'coop.l6.blind.swap'));
    stage(w, 'blind2', { x: 0, y: 1, z: zSw - 9, w: 44, h: 4, d: 3 }, () => { tell('p2', 'coop.l6.blind.walker'); tell('p1', 'coop.l6.blind.guide'); });

    // ============================================================ 7. LIGHTNING ROUND ======================
    deck(w, { x: 0, y: 0, z: zG0 - 22, w: 44, d: 44, path: true, trim: 0xffc83d });
    w.checkpoint({ x: 0, y: 0, z: zG0 - 4, real: true });
    const BZ = [
      { r: 'p1', x: -14, z: zG0 - 10 }, { r: 'p2', x: 14, z: zG0 - 14 }, { r: 'p1', x: 14, z: zG0 - 24 },
      { r: 'p2', x: -14, z: zG0 - 30 }, { r: 'p1', x: -14, z: zG0 - 38 }, { r: 'p2', x: 14, z: zG0 - 38 },
    ];
    const LT = 45;
    const ltN = () => c.get('lt:n', 0);
    let ltStart = null, ltDone = false;
    const clock = liveSign(w, { x: 0, y: 7, z: zG0 - 8, w: 11, h: 4, tw: 768, border: '#ffc83d' });
    BZ.forEach((b, i) => {
      deck(w, { x: b.x, y: 1.0, z: b.z + 4.0, w: 3, d: 3, trim: COL[b.r] });
      deck(w, { x: b.x, y: 2.0, z: b.z, w: 3, d: 3, trim: COL[b.r] });
      pedestal(w, { x: b.x, y: 2.0, z: b.z, role: b.r, color: COL[b.r], label: `#${i + 1}`, signW: 1.6, onPress: () => { if (ltN() === i) c.set('lt:n', i + 1); }, enabled: () => ltN() === i });
    });
    const lit = [];
    BZ.forEach((b, i) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.05, 20), glowMaterial(COL[b.r], 1.2)); m.position.set(b.x, 2.06, b.z); w.add(m); lit.push(m); });
    const gate3 = gate(w, { x: 0, y: 0, z: zG0 - 43.6, w: 44, h: 6, glow: 0xffc83d });
    c.on('lt:n', (v) => { if (v === 1) { ltStart = w.t; tell('all', 'coop.l6.light.go'); } if (v === 0) ltStart = null; });
    stage(w, 'light', { x: 0, y: 1, z: zG0 - 3, w: 44, h: 4, d: 4 }, () => tell('all', 'coop.l6.light.intro'));
    w.updaters.push((dt) => {
      const n = ltN();
      lit.forEach((m, i) => { m.material.color.setHex(COL[BZ[i].r]).multiplyScalar(i === n ? 2.6 : i < n ? 0.15 : 0.5); m.scale.setScalar(i === n ? 1 + Math.sin(w.t * 6) * 0.1 : 1); });
      let left = null;
      if (ltStart !== null && n < 6) {
        left = LT - (w.t - ltStart);
        if (left <= 0) { ltStart = null; c.set('lt:n', 0); tell('all', 'coop.l6.light.fail', { priority: 2 }); left = null; }
      }
      const nxt = n < 6 ? `NEXT: BUZZER #${n + 1} · ${N[BZ[n].r].toUpperCase()}` : 'DONE';
      clock.set(`LIGHTNING ROUND\n${nxt}\n${n >= 6 ? 'THE GATE OPENS' : left === null ? `${LT} SECONDS ONCE THE FIRST BUZZER GOES` : '⏱ ' + Math.ceil(left) + 's'}`, { border: left !== null && left < 10 ? '#ff4d5e' : '#ffc83d' });
      gate3.set(n >= 6);
      if (n >= 6 && !ltDone) { ltDone = true; tell('all', 'coop.l6.light.done', { priority: 2 }); }
    });

    // ============================================================ 8. the grand prize (fake) and the real one ===
    const zP0 = zG0 - 44;
    deck(w, { x: 0, y: 0, z: zP0 - 11, w: 44, d: 22, path: true, trim: 0xff4d5e });                // z zP0 … zP0-22
    w.checkpoint({ x: 0, y: 0, z: zP0 - 4, real: true });
    const fz = zP0 - 7;
    const fake = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 12, 48), glowMaterial(0xff4d5e, 2));
    fake.position.set(0, 1.9, fz); w.add(fake);
    dsign('GRAND PRIZE\nYOU HAVE WON', 0, 5, fz, { w: 6, h: 1.8, border: '#ffc83d' });
    beacon(w, 0, 0, fz, 0xffc0a0, 14);
    for (const lx of [-6, 6]) lantern(w, lx, 0, fz + 2);
    const fakeZ = c.zone({ x: 0, y: 1.9, z: fz, w: 3, h: 3.4, d: 3, need: 'both', shrink: 0 });
    let fakeDone = false;
    c.onEvent('fake', () => {
      if (fakeDone) return; fakeDone = true;
      fake.visible = false; w.burst(new THREE.Vector3(0, 2, fz), 0xffc83d, 40, 6);
      tell('all', 'coop.l6.prize.fake', { priority: 2 });
      w.after(6, () => { curtain.set(true); tell('all', 'coop.l6.prize.curtain', { priority: 2 }); });
    });
    fakeZ.onChange((zn) => { if (zn.active && !fakeDone) c.emit('fake'); });
    const zCur = zP0 - 13.5;
    const curtain = gate(w, { x: 0, y: 0, z: zCur, w: 44, h: 8, glow: 0xff4d5e });
    dsign('NOTHING TO SEE BEHIND THE CURTAIN', 0, 5.5, zCur + 0.6, { w: 10, h: 1.1, size: 30, border: '#ff4d5e' });
    const zU0 = zP0 - 22;
    const U = deck(w, { x: 0, y: 3.0, z: zU0 - 6, w: 44, d: 12, h: 3.0, path: true, trim: 0x3ddc97 });   // z zU0 … zU0-12
    const liftA = riser(w, { x: -6, y: 3.0, z: zU0 + 2.6, w: 3.2, d: 3.2, h: 0.6, drop: 3.0, always: true, speed: 4.2, color: 0xe9d9b0, trim: COL.p1 });
    const liftB = riser(w, { x: 6, y: 3.0, z: zU0 + 2.6, w: 3.2, d: 3.2, h: 0.6, drop: 3.0, always: true, speed: 4.2, color: 0xe9d9b0, trim: COL.p2 });
    const plA = plate(w, { x: -12, y: 0, z: zU0 + 2.6, need: 'p2', label: `${N.p2}: LIFT A` });
    const plU = plate(w, { x: 0, y: 3.0, z: zU0 - 3, need: 'p1', label: `${N.p1}: LIFT B` });
    w.updaters.push(() => { liftA.set(plA.pressed); liftB.set(plU.pressed); });
    dsign(`${N.p1} RIDES THE LEFT LIFT · ${N.p2} HOLDS ITS PLATE\nTHEN ${N.p2} STANDS ON THE RIGHT LIFT · ${N.p1} HOLDS ITS PLATE`, 0, 7.5, zU0 + 5, { w: 14, h: 2, size: 28, border: '#3ddc97' });
    const gz = zU0 - 8;
    w.goal({ x: 0, y: 3.0, z: gz });
    dsign('THE REAL GRAND PRIZE · BOTH OF YOU · IN THE CIRCLE', 0, 8.2, gz - 1, { w: 11, h: 1.5, border: '#3ddc97' });
    beacon(w, 0, 3.0, gz, 0xffe9a8, 20);
    stage(w, 'prize', { x: 0, y: 1, z: zP0 - 3, w: 44, h: 4, d: 4 }, () => tell('all', 'coop.l6.prize.intro'));
    stage(w, 'lifts', { x: 0, y: 1, z: zU0 + 5, w: 44, h: 4, d: 4 }, () => { tell('p1', 'coop.l6.prize.lift.p1'); tell('p2', 'coop.l6.prize.lift.p2'); });
    stage(w, 'top', { x: 0, y: 4, z: gz + 3, w: 44, h: 3, d: 5 }, () => tell('all', 'coop.l6.prize.real'));
    w.hooks.onPartnerDeath = () => { tell('all', 'coop.l6.partnerdown'); return true; };

    // ============================================================ scripted bots (tools/coop-bot.mjs) ==========
    const pedX = (r, i, n = 4, sp = 2.4) => bx[r] + (i - (n - 1) / 2) * sp;
    const useP = (x, z, until) => ({ x, z, r: 1.1, use: true, until });
    const r1Steps = Q.flatMap((_, qi) => [useP(pedX(me, 0), bz, () => getv(qKey('s', me, qi)) >= 0), useP(pedX(me, 0), bz, () => getv(qKey('g', me, qi)) >= 0)]);
    const wSteps = WH.map((_, ri) => useP(pedX(me, 0, 2, 3.4), wz, () => getv(wKey(me, ri)) >= 0));
    const s = sideOf(me);
    const lane = laneC[me][0], jz1 = lane[2].z;
    const sosSteps = [
      useP(pedX(me, 0, 2, 3.4), hz, () => !!c.get(sosKey(me), null)),
      { x: 0, z: ZH1 + 3, r: 1.5, until: () => !!exits() },
      ...lane.map((p, j) => (j === 2 ? { x: p.x, z: p.z, r: 1.0, until: () => RX[me][1].k > 0.97 } : { x: p.x, z: p.z, r: 1.0 })),
      { x: s * XR, z: jz1, r: 1.0 },
      { x: s * XC, z: jz1 - 2, r: 1.0 },
      { x: s * XC, z: ZM + 3, r: 1.5 },
      { x: 0, z: ZM - 8, r: 2 },
    ];
    const rowSteps = (fld) => fld.safe.map((sf, k) => ({ x: XC4[sf], z: zRow(fld === FA ? zF : zSw, k), r: 0.7 }));
    const blind = (role) => {
      const out = [];
      const mk = (walker, fld, z0, side, last) => {
        if (role === walker) { out.push({ x: 0, z: z0 - 6, r: 1.5 }); out.push(...rowSteps(fld)); out.push({ x: 0, z: fld.zEnd - 4, r: 1.5 }); }
        else {
          out.push({ x: side * 16, z: z0 - 6, r: 1.5 }); out.push({ x: side * 16, z: z0 - 26, r: 1.5 });
          out.push({ x: side * 16, z: z0 - 26, r: 1.5, until: () => P.has && P.sz < fld.zEnd - 2 });
          out.push({ x: side * 16, z: fld.zEnd - 4, r: 1.5 });
          out.push({ x: 0, z: fld.zEnd - 4, r: 1.5 });
        }
      };
      mk('p1', FA, zF, 1);
      mk('p2', FB, zSw, -1);
      return out;
    };
    const lt = (role) => BZ.flatMap((b, i) => (b.r !== role ? [] : [
      { x: b.x, z: b.z + 5.5, r: 1.2 }, { x: b.x, z: b.z + 4.0, r: 0.8 }, useP(b.x, b.z, () => ltN() > i),
    ]));
    const finale = {
      p1: [
        { x: 0, z: fz, r: 1.0, until: () => fakeDone }, { x: 0, z: zCur + 3, r: 1.5, until: () => curtain.passable },
        { x: -6, z: zU0 + 2.6, r: 0.8, until: () => game.player.y > 2.7 },
        { x: 0, z: zU0 - 0.5, r: 0.8, until: () => P.has && Math.abs(P.sx - 6) < 1.4 && Math.abs(P.sz - (zU0 + 2.6)) < 1.6 && P.sy < 1 },   // wait until they stand on the right lift
        { x: 0, z: zU0 - 3, r: 0.8, until: () => P.has && P.sy > 2.7 },
      ],
      p2: [
        { x: 0, z: fz, r: 1.0, until: () => fakeDone }, { x: 0, z: zCur + 3, r: 1.5, until: () => curtain.passable },
        { x: -12, z: zU0 + 2.6, r: 0.8, until: () => P.has && P.sy > 2.7 },
        { x: 6, z: zU0 + 2.6, r: 0.8, until: () => game.player.y > 2.7 },
      ],
    };
    const nearZ = (z) => () => game.player.z < z;
    const plan = [
      { follow: true, until: nearZ(zN - 3) },                                                           // course 1 -> studio
      ...r1Steps, { follow: true, until: nearZ(zB0 - 8) },                                              // gate -> backstage
      ...LF.steps(me), { follow: true, until: nearZ(zD - 4) },
      ...wSteps, { follow: true, until: nearZ(zH0 - 3) },
      ...sosSteps, { follow: true, until: nearZ(zF - 3) },
      ...blind(me), { follow: true, until: nearZ(zG0 - 3) },
      ...lt(me), { x: 0, z: zG0 - 41, r: 1.5, until: () => gate3.passable }, { follow: true, until: nearZ(zP0 - 3) },
      ...finale[me], { follow: true },
    ];
    botSteps(w, { p1: plan, p2: plan });
  },
};
