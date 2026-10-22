import * as THREE from 'three';
import { plainMaterial } from '../../engine/materials.js';
import { retreatEnv, deck, sign, lantern, lake, stage, setDeathRule, gate, beacon, COL } from './kit.js';
import { liveSign, pedestal } from './secret-santa-kit.js';
import { TILE_W, TILE_D, tileZ, tileAt, CARDS, planRound, planTraps, floorLabel, floorRect, timerRing, bigDie, pawn } from './game-night-kit.js';

// Session 11 — Game Night. A giant board game in the lodge games room.
// One of you is the ROLLER (stands at the dice console, sees which tiles are traps and where the ring is), the other is the MOVER
// (walks the board, sees the chance card). target = start + roll + card; stand on it for a second before the ring closes.
//   1 warm-up board      2 chance cards      3 swap-roles space      4 the "shortcut" that is a loop
//   5 the rigged die (the counsellor insists it is fair)      6 the last board: you each move your own roll, onto the SAME tile
// First-time pairs: about 10 minutes.

const SEGS = [
  { key: 'a', title: 'BOARD 1 · WARM-UP', n: 6, R: 2, cards: ['none'], trap: 0.5 },
  { key: 'b', title: 'BOARD 2 · CHANCE', n: 11, R: 4, cards: ['f1', 'b1', 'none', 'f2'], trap: 0.4 },
  { key: 'c', title: 'BOARD 3 · SWAP SPACE', n: 10, R: 3, cards: ['f1', 'b1', 'none'], trap: 0.4, fixed: [4], swap: 4 },
  { key: 'd', title: 'BOARD 4 · THE SHORTCUT', n: 11, R: 4, cards: ['dbl', 'b1', 'f1', 'none'], trap: 0.45, loop: true },
  { key: 'e', title: 'BOARD 5 · FAIR DICE', n: 8, R: 3, cards: ['none'], trap: 0.5, rigged: true, minD: 2 },
];
const HUB = 10;                                  // depth of the hub deck before each board
const LANE_X = -9;                             // the Roller's walkway
const CONSOLE_X = -9.0;
const FP = [{ s: { p1: 0, p2: 3 }, t: 6 }, { s: { p1: 5, p2: 5 }, t: 8 }];   // final board: starts and the shared target tile
const F_N = 10;

export default {
  id: 'coop11',
  name: 'Game Night',
  music: 'l1',
  deathRule: 'self',
  completeQuip: 'Sixteen rolls, a loop and one rigged die. The counsellor is calling it a draw. It was a win. He is calling it a draw.',
  titleCam: { center: [0, 2, -90], radius: 34, height: 14 },

  build(w, game) {
    retreatEnv(w, { mood: 'night' });
    lake(w, -30, 700, 0x1f3550);
    const c = w.coop, me = c.me, other = c.other, N = c.names, P = c.partner;
    w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    const tell = (r, k, o) => c.tell(r, k, o);
    const cp = (x, y, z) => w.checkpoint({ x, y, z, real: true });
    const toast = (t, k = '') => game.ui.toast(t, k);
    const roller = () => c.get('roller', 'p1');
    const mover = () => (roller() === 'p1' ? 'p2' : 'p1');
    const pos = () => c.get('pos', { seg: 0, s: 0, ri: 0 });
    const rd = () => c.get('rd', null);
    const res = () => c.get('res', null);
    const oppo = (r) => (r === 'p1' ? 'p2' : 'p1');

    // ============================================================ the lobby (games room) ==========================
    const lobbyEnd = -36;
    deck(w, { x: 0, y: 0, z: (6 + lobbyEnd) / 2, w: 28, d: 6 - lobbyEnd, path: false });
    sign(w, 'SESSION 11 · GAME NIGHT', 0, 10.8, -16, { w: 14, h: 1.9 });
    for (const lx of [-12, 12]) { lantern(w, lx, 0, 2); lantern(w, lx, 0, -14); lantern(w, lx, 0, -30); }
    bigDie(w, -17, 3.2, -8, 3.2); bigDie(w, 17, 3.2, -20, 2.6, 0xe9d9c4); bigDie(w, -16, 2.4, -26, 1.8, 0xd8c8b0);
    pawn(w, -12, 0, -9, 0xff9a3d, 1.3); pawn(w, 12, 0, -9, 0x39d7c9, 1.3);
    sign(w, 'THE ROLLER SEES THE TRAPS AND THE DIE.', 0, 6.4, -24, { w: 13, h: 1.3, size: 40 });
    sign(w, 'THE MOVER SEES THE CHANCE CARD. TALK.', 0, 4.7, -24, { w: 13, h: 1.3, size: 40, border: '#39d7c9' });
    sign(w, 'TARGET = START + ROLL + CARD · STAND ON IT ONE SECOND', 0, 3.0, -28.5, { w: 14, h: 1.2, size: 34 });
    cp(0, 0, -31);
    stage(w, 'welcome', { x: 0, y: 1, z: 2, w: 30, h: 4, d: 8 }, () => { tell('p1', 'coop.l11.intro.p1', { priority: 2 }); tell('p2', 'coop.l11.intro.p2', { priority: 2 }); });
    stage(w, 'rules', { x: 0, y: 1, z: -22, w: 28, h: 4, d: 6 }, () => tell('all', 'coop.l11.rules'));

    // ============================================================ boards ==========================================
    const boards = [];
    const planCache = new Map();
    const derive = (R) => {
      const key = R.seg + ':' + R.ser;
      let pl = planCache.get(key);
      if (!pl) {
        const cfg = SEGS[R.seg];
        const rr = c.rng(900 + R.seg * 101 + R.ser * 7);
        pl = planRound(rr, cfg, R.s, R.ri);
        pl.tr = planTraps(c.rng(1900 + R.seg * 101 + R.ser * 7), cfg.n, R.s, pl.t, cfg.trap);
        pl.T = 18 + 3 * pl.d;
        planCache.set(key, pl);
      }
      return pl;
    };
    const activeOf = (i) => { const R = rd(), rs = res(); return R && R.seg === i && !(rs && rs.ser === R.ser) ? R : null; };

    let zTop = lobbyEnd;
    SEGS.forEach((cfg, i) => {
      const n = cfg.n, L = n * TILE_D;
      const zB0 = i === 0 ? zTop : zTop - HUB;
      const zEnd = zB0 - L, zMid = zB0 - L / 2;
      const hubC = zB0 + HUB / 2;
      if (i > 0) {
        deck(w, { x: 0, y: 0, z: hubC, w: 28, d: HUB, path: false });
        cp(0, 0, hubC - 1);
        for (const lx of [-12, 12]) lantern(w, lx, 0, hubC);
        stage(w, 'hub' + i, { x: 0, y: 1, z: zB0 + 3, w: 28, h: 4, d: 4 }, () => tell('all', 'coop.l11.hub.' + cfg.key));
      } else {
        stage(w, 'hub0', { x: 0, y: 1, z: zB0 + 3, w: 28, h: 4, d: 4 }, () => tell('all', 'coop.l11.hub.a'));
      }
      const B = { cfg, zB0, zEnd, zMid, n, tiles: [], traps: [] };
      boards.push(B);
      // tiles
      for (let k = 0; k < n; k++) {
        const tz = tileZ(zB0, k);
        const special = k === 0 ? 0x5fbf86 : k === n - 1 ? 0xe9c24a : cfg.swap === k ? 0xe8963a : (k % 2 ? 0xc9a77a : 0xb48e5e);
        deck(w, { x: 0, y: 0, z: tz, w: TILE_W, d: TILE_D, color: special });
        floorRect(w, 0, 0, tz, 0.08, TILE_D - 0.2, 0x3a2a1a, 0.55);
        floorLabel(w, String(k), 0, 0, tz, { size: 2.4, color: k === n - 1 ? '#3a2a00' : '#fff6dc' });
        if (cfg.swap === k) floorLabel(w, '⇄', 0, 0, tz - 1.2, { size: 1.5, color: '#fff6dc' });
        // trap halves (hazard kills, shows only for the Roller)
        const row = [];
        for (const half of [0, 1]) {
          const hx = half === 0 ? -1.5 : 1.5;
          const hz = w.hazard({ x: hx, y: 0.9, z: tz, w: 2.7, h: 1.8, d: 3.7, color: 0xff3b55 });
          hz.core.position.y = -0.86; hz.core.scale.y = 0.05; hz.shell.position.y = -0.84; hz.shell.scale.y = 0.03;
          hz.enabled = false; hz.group.visible = false; hz.predict = () => false;
          const tint = floorRect(w, hx, 0, tz, 2.7, 3.7, 0xff3b55, 0.0, true);
          row.push({ hz, tint });
        }
        B.tiles.push({ z: tz }); B.traps.push(row);
      }
      // lane for the Roller + console
      deck(w, { x: LANE_X, y: 0, z: zMid, w: 6, d: L, color: 0x8c7a62 });
      lantern(w, -11.5, 0, zB0 - 1); lantern(w, -11.5, 0, zEnd + 1);
      const roleBanner = liveSign(w, 0, 9.6, zB0 + 3.5, { w: 12, h: 1.4, tw: 900, border: '#ffc83d' });
      roleBanner.set(cfg.title);
      const timer = liveSign(w, 0, 7.6, zB0 + 3.5, { w: 8, h: 1.7, tw: 760, border: '#39d7c9', size: 0 });
      // console + roller sign
      const rollSign = liveSign(w, -13.5, 4.0, zMid, { w: 7, h: 3.6, tw: 760, rotY: Math.PI / 2, border: '#ff9a3d', size: 30 });
      const cardSign = liveSign(w, 13.5, 4.0, zMid, { w: 7, h: 3.6, tw: 760, rotY: -Math.PI / 2, border: '#39d7c9', size: 30 });
      const moverReady = () => { const s = pos().s; return P.has && !P.dead && Math.abs(P.sy) < 1.5 && tileAt(zB0, n, P.sx, P.sz) === s; };
      const canRoll = () => pos().seg === i && roller() === me && !activeOf(i) && moverReady() && (!res() || w.t - (res().at || 0) > 2.0);
      pedestal(w, {
        x: CONSOLE_X, y: 0, z: zMid, color: 0xff9a3d,
        label: () => 'Roll the die',
        enabled: canRoll,
        onUse: () => {
          if (!canRoll()) return;
          const p = pos(), ser = (rd()?.ser ?? 0) + 1;
          c.set('rd', { seg: i, ser, s: p.s, ri: p.ri, t0: w.t + 0.3 });
          game.audio.confirm?.();
        },
      });
      // ring
      const ring = timerRing(w, 0xffc83d);
      // shortcut that is a loop
      if (cfg.loop) {
        deck(w, { x: 4.75, y: 0, z: tileZ(zB0, 3), w: 3.5, d: TILE_D, color: 0xd8c27a });
        const bz0 = tileZ(zB0, 3), bz1 = tileZ(zB0, 8);
        deck(w, { x: 8.5, y: 0, z: (bz0 + bz1) / 2, w: 4, d: (bz0 - bz1) + TILE_D, color: 0xd8c27a });
        floorRect(w, 8.5, 0, bz1, 3.6, 3.6, 0xe8963a, 0.7, true);
        floorLabel(w, '★ 9', 8.5, 0, bz1, { size: 2.6, color: '#3a2a00' });
        for (let k = 3; k < 8; k++) floorLabel(w, '→', 8.5, 0, tileZ(zB0, k) - 0.5, { size: 1.6, color: '#fff6dc', opacity: 0.7 });
        sign(w, 'SHORTCUT ★ TO TILE 9', 6.0, 3.8, tileZ(zB0, 3) + 0.4, { w: 6, h: 1.1, size: 40, border: '#e8963a' });
        const warn = liveSign(w, 8.5, 4.6, tileZ(zB0, 6), { w: 6.5, h: 2.2, tw: 760, rotY: Math.PI / 2, border: '#ff4d5e', size: 32, text: 'ROLLER ONLY:\nTHE SHORTCUT IS A LOOP.\nITS END SENDS YOU BACK THREE.' });
        w.updaters.push(() => { warn.mesh.visible = roller() === me; });
        let loopT = -9;
        w.trigger({ x: 8.5, y: 1.2, z: bz1, w: 3.2, h: 2.6, d: 3.2, once: false, onEnter: () => {
          game.player.teleport(0, 0.01, tileZ(zB0, 5));
          if (w.t - loopT > 4) { loopT = w.t; tell('all', 'coop.l11.loop.caught'); }
        } });
      }
      // rigged die (only the Mover sees the true face)
      let die = null;
      if (cfg.rigged) die = liveSign(w, 0, 6.2, zMid, { w: 3.2, h: 3.2, tw: 384, border: '#ffffff', size: 200, text: '?' });
      // gate at the end
      const G = gate(w, { x: 0, y: 0, z: zEnd - 0.4, w: 30, h: 7, glow: 0xffc83d });
      sign(w, i === SEGS.length - 1 ? 'THE LAST BOARD IS UP AHEAD' : 'FINISH THE BOARD TO OPEN THE GATE', 0, 4.4, zEnd + 0.9, { w: 10, h: 1.1, size: 38 });
      B.gate = G;

      // ---------------- per frame ----------------
      let dwell = 0, doneSer = -1, lastShown = '';
      w.updaters.push((dt) => {
        const R = activeOf(i), cur = pos();
        const pl = R ? derive(R) : null;
        const amRoller = roller() === me;
        const left = R ? R.t0 + pl.T - w.t : 0;
        G.set(cur.seg > i);
        // traps
        for (let k = 0; k < n; k++) for (let h = 0; h < 2; h++) {
          const t = B.traps[k][h], on = !!pl && pl.tr[k] === h;
          const armed = on && w.t > R.t0 + 1.0;
          t.hz.enabled = armed;
          t.hz.group.visible = on && amRoller;
          t.tint.material.opacity = on && amRoller ? (armed ? 0.55 : 0.25 + 0.2 * Math.sin(w.t * 12)) : 0;
        }
        // ring (Roller only): the base target tile (the roll alone)
        ring.visible = !!R && amRoller && left > 0;
        if (ring.visible) { ring.position.set(0, 0.08, tileZ(zB0, pl.base)); ring.scale.setScalar(1.3 + 1.7 * Math.max(0, left) / pl.T); }
        // timer sign
        const head = `${N[roller()]} rolls · ${N[mover()]} moves`;
        let t;
        if (cur.seg !== i) t = cur.seg > i ? 'BOARD DONE' : cfg.title;
        else if (R) t = `${head}\nTIME ${Math.max(0, Math.ceil(left))}`;
        else t = `${head}\n${amRoller ? 'ROLL THE DIE (E)' : 'WAIT FOR THE ROLL'}`;
        timer.set(t);
        // roller console sign
        let rs;
        if (cur.seg !== i) rs = amRoller ? 'ROLLER CONSOLE\n(not this board)' : '';
        else if (!amRoller) rs = '';
        else if (R) {
          rs = `ROLL: ${pl.shown}\nMOVER STARTS ON TILE ${R.s}\nRING = TILE ${pl.base}\nRED = TRAP. TELL THEM.\nTHEY HOLD THE CARD.`;
          if (cfg.rigged) rs = `ROLL: ${pl.shown}\nMOVER STARTS ON TILE ${R.s}\nRED = TRAP. TELL THEM.\nTHE DIE IS FAIR. (SO IT SAYS)`;
        } else rs = moverReady() ? 'ROLLER CONSOLE\nPRESS E TO ROLL' : `ROLLER CONSOLE\nWAITING FOR YOUR PARTNER\nON TILE ${cur.s}`;
        rollSign.set(rs);
        rollSign.mesh.visible = rs !== '';
        // mover card sign
        let cs = '';
        if (cur.seg === i && roller() !== me) cs = R ? `${CARDS[pl.card].text}\nYOU START ON TILE ${R.s}\nYOUR PARTNER KNOWS THE ROLL.` : 'CHANCE CARD\n(drawn when the die is rolled)';
        cardSign.set(cs); cardSign.mesh.visible = cs !== '';
        if (die) {
          die.mesh.visible = !amRoller && !!R && cur.seg === i;
          if (R) die.set(String(pl.r));
        }
        // mover: dwell on the target tile / time out
        if (R && !amRoller && doneSer !== R.ser) {
          const pp = game.player, on = pp.grounded && tileAt(zB0, n, pp.x, pp.z) === pl.t && Math.abs(pp.y) < 0.6;
          dwell = on ? dwell + dt : 0;
          if (dwell >= 0.9) {
            doneSer = R.ser; dwell = 0;
            const last = R.ri + 1 >= cfg.R;
            c.set('res', { ser: R.ser, ok: true, t: pl.t, at: w.t });
            c.set('pos', last ? { seg: i + 1, s: 0, ri: 0 } : { seg: i, s: pl.t, ri: R.ri + 1 });
            if (cfg.swap === pl.t && !last) c.set('roller', oppo(roller()));
          } else if (left < 0) {
            doneSer = R.ser; dwell = 0;
            c.set('res', { ser: R.ser, ok: false, t: R.s, at: w.t });
          }
        } else if (!R) dwell = 0;
      });
      // roll announcements
      c.on('rd', (R) => {
        if (!R || R.seg !== i) return;
        const pl = derive(R);
        if (roller() === me) toast(`ROLL ${pl.shown} · Mover on tile ${R.s} · ring on ${pl.base}${cfg.rigged ? '' : ' · they hold the card'}`, 'gold');
        else toast(`CARD: ${CARDS[pl.card].name} · you start on tile ${R.s}`, 'gold');
        if (R.ri === 0 && R.ser === 1) tell('all', 'coop.l11.roll.first');
      });
      let seen = 0;
      c.on('res', (v) => {
        const R = rd();
        if (!v || !R || R.seg !== i || R.ser !== v.ser) return;
        seen++;
        if (v.ok) {
          if (roller() === me) { /* roller keeps its place */ } else { w.respawn = { x: 0, y: 0, z: tileZ(zB0, v.t), yaw: 0 }; }
          toast(`Landed on tile ${v.t}!`, 'good');
          if (cfg.swap === v.t && R.ri + 1 < cfg.R) { tell('all', 'coop.l11.swap.done'); toast('SWAP! You change places.', 'gold'); }
          else if (cfg.rigged && seen === 1) tell('all', 'coop.l11.rigged.reveal');
          else if (seen <= 2 || seen % 3 === 0) tell('all', 'coop.l11.ok');
        } else {
          if (roller() !== me) { game.player.teleport(0, 0.01, tileZ(zB0, v.t)); w.respawn = { x: 0, y: 0, z: tileZ(zB0, v.t), yaw: 0 }; }
          toast('Time is up. Back to the start of the turn.', 'bad');
          tell('all', cfg.rigged && seen === 1 ? 'coop.l11.rigged.reveal' : 'coop.l11.timeup');
        }
      });
      if (cfg.swap != null) stage(w, 'swapzone', { x: 0, y: 1, z: tileZ(zB0, cfg.swap), w: 6, h: 4, d: 4 }, () => tell('all', 'coop.l11.swap.tile'));
      stage(w, 'end' + i, { x: 0, y: 1, z: zEnd + 4, w: 28, h: 4, d: 3 }, () => tell('all', 'coop.l11.gate'));
      zTop = zEnd;
    });

    // ============================================================ the last board: onto the SAME tile =============
    const hubFz = zTop;
    const fz0 = zTop - HUB;                                     // board start
    const fEnd = fz0 - F_N * TILE_D;
    deck(w, { x: 0, y: 0, z: zTop - HUB / 2, w: 28, d: HUB });
    cp(0, 0, zTop - 3);
    for (const lx of [-12, 12]) lantern(w, lx, 0, zTop - 5);
    stage(w, 'hubF', { x: 0, y: 1, z: fz0 + 3, w: 28, h: 4, d: 4 }, () => { tell('all', 'coop.l11.hub.f'); setDeathRule(w, 'revive'); });
    sign(w, 'LAST BOARD · BOTH OF YOU · ONE TILE', 0, 9.6, fz0 + 3.5, { w: 13, h: 1.4, size: 40 });
    const fTimer = liveSign(w, 0, 7.6, fz0 + 3.5, { w: 8, h: 1.7, tw: 760, border: '#39d7c9' });
    const fInfo = liveSign(w, 0, 4.4, fz0 + 3.5, { w: 12, h: 3.2, tw: 1000, border: '#ffc83d', size: 30 });
    const laneX = (r, inner) => (r === 'p1' ? (inner ? -0.75 : -2.25) : (inner ? 0.75 : 2.25));
    for (let k = 0; k < F_N; k++) {
      const tz = tileZ(fz0, k);
      deck(w, { x: -1.5, y: 0, z: tz, w: 3, d: TILE_D, color: k % 2 ? 0xd9a977 : 0xc8925f });
      deck(w, { x: 1.5, y: 0, z: tz, w: 3, d: TILE_D, color: k % 2 ? 0x8fc4c0 : 0x7bb2ae });
      floorLabel(w, String(k), -1.5, 0, tz, { size: 1.9 }); floorLabel(w, String(k), 1.5, 0, tz, { size: 1.9 });
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, F_N * TILE_D), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.28 }));
    rail.position.set(0, 0.85, fz0 - (F_N * TILE_D) / 2); w.add(rail);
    w.collider({ x: 0, y: 0.9, z: fz0 - (F_N * TILE_D) / 2, w: 0.3, h: 1.8, d: F_N * TILE_D });
    const fTraps = { p1: [], p2: [] };
    for (const r of ['p1', 'p2']) for (let k = 0; k < F_N; k++) {
      const row = [];
      for (const inner of [false, true]) {
        const hz = w.hazard({ x: laneX(r, inner), y: 0.9, z: tileZ(fz0, k), w: 1.35, h: 1.8, d: 3.7, color: 0xff3b55 });
        hz.core.position.y = -0.86; hz.core.scale.y = 0.05; hz.shell.position.y = -0.84; hz.shell.scale.y = 0.03;
        hz.enabled = false; hz.group.visible = false; hz.predict = () => false;
        row.push(hz);
      }
      fTraps[r].push(row);
    }
    const GF = gate(w, { x: 0, y: 0, z: fEnd - 0.4, w: 30, h: 7, glow: 0xffc83d });
    const gy = 0, gzz = fEnd - 12;
    deck(w, { x: 0, y: 0, z: fEnd - 10, w: 28, d: 20 });
    sign(w, 'ONE TILE. THE SAME ONE. AT THE SAME TIME.', 0, 4.4, fEnd + 0.9, { w: 10, h: 1.1, size: 38 });
    w.goal({ x: 0, y: gy, z: gzz });
    beacon(w, 0, gy, gzz, 0xffe9a8, 22);
    for (const lx of [-6, 6]) lantern(w, lx, gy, gzz + 3);
    cp(0, 0, fEnd - 4);
    // final-board rounds
    const fPlan = (ri) => {
      const rr = c.rng(7000 + ri * 13), plan = FP[ri], out = { t: plan.t, p: {} };
      const pickCard = (r, avoid) => {
        const d = plan.t - plan.s[r];
        for (const k of ['f1', 'b1', 'none', 'f2', 'dbl']) {
          if (k === avoid && k !== 'none') continue;
          const rv = CARDS[k].inv(d);
          if (rv >= 1 && rv <= 6) return { d, r: rv, card: k };
        }
        return { d, r: Math.min(6, d), card: 'none' };
      };
      out.p.p1 = pickCard('p1', null); out.p.p2 = pickCard('p2', out.p.p1.card);
      for (const r of ['p1', 'p2']) out.p[r].tr = planTraps(rr, F_N, plan.s[r], plan.t, 0.55);
      return out;
    };
    const fph = () => c.get('fph', 0);
    const fri = () => fph() >> 1;
    const fActive = () => fph() % 2 === 1 && fph() < 4;
    const FT = 48;
    let fReadyT = 0, fReady = false, fDwell = 0, fSelf = false;
    c.presence('fr', false);
    c.onPresence('fr', (both) => { fReady = both; if (both) fReadyT = Math.max(fReadyT, w.t); });
    c.on('fph', (v) => {
      if (v === 4) { GF.set(true); tell('all', 'coop.l11.final.done'); return; }
      if (v % 2 === 1) {
        const pp = fPlan(v >> 1).p[oppo(me)];
        toast(`PARTNER: starts ${FP[v >> 1].s[oppo(me)]} · rolled ${pp.r} · ${CARDS[pp.card].name}`, 'gold');
      } else if (v === 2) tell('all', 'coop.l11.final.r2');
    });
    c.on('ffail', () => {
      tell('all', 'coop.l11.timeup');
      const ri = fri(), z = tileZ(fz0, FP[ri].s[me]);
      game.player.teleport(me === 'p1' ? -1.5 : 1.5, 0.01, z);
    });
    w.updaters.push((dt) => {
      const ph = fph(), ri = fri(), act = fActive();
      const t0 = c.get('ft0', 0), left = t0 + FT - w.t;
      GF.set(ph >= 4);
      const plan = fPlan(Math.min(ri, 1));
      // traps: lane r is shown only to the partner
      for (const r of ['p1', 'p2']) for (let k = 0; k < F_N; k++) for (let h = 0; h < 2; h++) {
        const hz = fTraps[r][k][h], on = act && plan.p[r].tr[k] === h;     // h: 0 outer, 1 inner
        hz.enabled = on && w.t > t0 + 1.0;
        hz.group.visible = on && r !== me;
      }
      fTimer.set(act ? `TIME ${Math.max(0, Math.ceil(left))}` : ph >= 4 ? 'BOARD DONE' : 'STAND ON YOUR START TILE');
      const pp = plan.p[oppo(me)], mine = plan.p[me];
      void mine;
      fInfo.set(ph >= 4 ? 'WELL.' : `YOUR PARTNER (${N[oppo(me)]}):\nSTARTS ON TILE ${FP[Math.min(ri, 1)].s[oppo(me)]} · ROLLED ${pp.r} · ${CARDS[pp.card].name}\nYOU CANNOT SEE YOUR OWN ROLL. THEY SEE IT.\nTRAPS IN YOUR LANE ARE ONLY VISIBLE TO THEM.`);
      // readiness: be on your start tile
      const pl = game.player, myTile = tileAt(fz0, F_N, pl.x, pl.z, 3.1);
      const sideOk = me === 'p1' ? pl.x < 0.2 : pl.x > -0.2;
      const onStart = pl.grounded && sideOk && myTile === FP[Math.min(ri, 1)].s[me];
      fDwell = onStart ? fDwell + dt : 0;
      if (!act && ph < 4) c.presence('fr', fDwell > 0.8); else c.presence('fr', false);
      if (c.isHost && !act && ph < 4 && fReady && w.t > fReadyT + 0.5 && w.t - (c.get('fts', -99)) > 3.5) {
        c.set('ft0', w.t + 0.3); c.set('fph', ph + 1); fReady = false;
      }
      if (act) {
        const tile = tileAt(fz0, F_N, pl.x, pl.z, 3.1);
        const on = pl.grounded && tile === plan.t && sideOk;
        if (on !== fSelf) { fSelf = on; c.set('fok.' + me, on); }
        if (c.isHost && c.get('fok.p1', false) && c.get('fok.p2', false)) { c.set('fts', w.t); c.set('fph', ph + 1); c.set('fok.p1', false); c.set('fok.p2', false); fSelf = false; if (ph + 1 === 2) w.respawn = { ...w.respawn }; }
        else if (c.isHost && left < 0) { c.set('fph', ph - 1); c.set('fts', w.t); c.set('ffail', w.t); c.set('fok.p1', false); c.set('fok.p2', false); }
      } else if (fSelf) { fSelf = false; c.set('fok.' + me, false); }
    });
    c.on('fph', (v) => { if (v % 2 === 0 && v < 4) w.respawn = { x: me === 'p1' ? -1.5 : 1.5, y: 0, z: tileZ(fz0, FP[v >> 1].s[me]), yaw: 0 }; });
    stage(w, 'finalend', { x: 0, y: 1, z: fEnd - 4, w: 28, h: 4, d: 4 }, () => tell('all', 'coop.l11.finish'));

    w.hooks.onPartnerDeath = () => { if (Math.random() < 0.4) tell('all', 'coop.l11.partnerdown'); return true; };

    // ============================================================ scripted bots (tools/coop-bot.mjs) =============
    const g = game;
    void plainMaterial; void COL;
    const goTile = (p, x, zk) => (Math.abs(p.x - x) > 0.25 && p.z > zk + 2.4 ? { x, z: zk + 3.0 } : { x, z: zk });      // shift sideways BEFORE entering a trap tile
    const half = (tr) => (tr === 0 ? 1.5 : -1.5);              // the safe half of a tile with a trap on `tr`
    w.botPlan = () => {
      const p = g.player, cur = pos();
      if (cur.seg < SEGS.length) {
        const B = boards[cur.seg], cfg = B.cfg, R = activeOf(cur.seg), pl = R ? derive(R) : null;
        if (roller() === me) {
          if (p.z > B.zB0 - 0.5 && Math.abs(p.x - LANE_X) > 2.5) return { x: LANE_X + 1, z: B.zB0 + 1.2 };
          const near = Math.hypot(p.x - (CONSOLE_X), p.z - B.zMid) < 1.0;
          if (near && !R) g.useFocus();
          return { x: CONSOLE_X, z: B.zMid, wait: near };
        }
        // mover
        const idx = tileAt(B.zB0, cfg.n, p.x, p.z);
        if (R) {
          if (idx < 0 || idx < R.s) return { x: 0, z: tileZ(B.zB0, R.s) };
          if (idx >= pl.t) return { x: 0, z: tileZ(B.zB0, pl.t), wait: true };
          const k = idx + 1, tr = pl.tr[k];
          return goTile(p, tr < 0 ? Math.max(-1.5, Math.min(1.5, p.x)) : half(tr), tileZ(B.zB0, k));
        }
        const nearS = Math.hypot(p.x, p.z - tileZ(B.zB0, cur.s));
        return { x: 0, z: tileZ(B.zB0, cur.s), wait: nearS < 0.5 };
      }
      // final board
      if (p.x < -5 && p.z > hubFz - 0.5) return { x: -9, z: hubFz - 3 };      // leave the Roller's lane along the lane, not across the gap
      const ph = fph(), ri = Math.min(fri(), 1), plan = fPlan(ri), s = FP[ri].s[me];
      if (ph >= 4) return { x: 0, z: gzz };
      const idx = tileAt(fz0, F_N, p.x, p.z, 3.1);
      const lx = me === 'p1' ? -1.5 : 1.5;
      if (P.has && P.dead && ph < 4) return { x: me === 'p1' ? -0.5 : 0.5, z: P.sz, wait: Math.abs(p.z - P.sz) < 0.6 };      // revive range
      if (!fActive()) {
        if (p.z > fz0 - 0.5) return { x: lx, z: fz0 - 0.8 };
        return { x: lx, z: tileZ(fz0, s), wait: Math.hypot(p.x - lx, p.z - tileZ(fz0, s)) < 0.4 };
      }
      if (idx < 0) return { x: lx, z: tileZ(fz0, s) };
      if (idx >= plan.t) return { x: lx, z: tileZ(fz0, plan.t), wait: true };
      const k = idx + 1, tr = plan.p[me].tr[k];
      return goTile(p, tr < 0 ? Math.max(me === 'p1' ? -2.25 : 0.75, Math.min(me === 'p1' ? -0.75 : 2.25, p.x)) : laneX(me, tr === 0), tileZ(fz0, k));
    };
    w._gn = () => { const R = rd(); return { rd: R, res: res(), pos: pos(), roller: roller(), plan: R ? derive(R) : null, respawn: w.respawn, me: { x: g.player.x, y: g.player.y, z: g.player.z } }; };
    w.botIndex = () => (pos().seg * 10 + (pos().ri || 0));
    w.botList = [];
  },
};
