import * as THREE from 'three';
import { glowMaterial } from '../../engine/materials.js';
import { retreatEnv, deck, plate, gate, riser, sign, lantern, lake, stage, beacon, COL } from './kit.js';
import { carryKit, chef as makeChef, dinnerBots, stepsFor, lift as makeLift, track } from './dinner-date-kit.js';

// Session 7 — Dinner Date. A seven-course evening at the lakeside bistro, cooked and served by two people who can each carry exactly one
// thing and who have to hand it to each other (E) because a plate does not survive a jump:
//   1 Reservations   a card to the podium, then fine china over three gaps: hand it across, jump after it
//   2 Appetisers     one loads canapé trays on a belt, one catches them across the chasm; the chiller door crushes anything that is late
//   3 Walk-in        one stands on the plate that holds the freezer door, the other fetches the ice; then swap
//   4 Soup           one stirs while the other ladles; carry it over a wet floor and a rolling trolley without sloshing it away
//   5 The Chef       a grumpy chef patrols with a vision cone: one bangs the pots to lure him, the other smuggles the ingredient out
//   6 Main course    a recipe only one of you can read, a glossary only the other can read, three shelves, one pan
//   7 Dessert        a soufflé up a tall tower: a lift that is called from the top, a dumbwaiter, a hand across the last gap
//   8 The Bill       "bill please" is not the end. Both of you pay.
// Death rule: 'self'. Nothing hurts without a tell: every bar fills on screen, every item shakes and glows before it breaks.

const FLOOR = { tex: 'tile', color: 0xe8e2d6 };
const STEEL = { tex: 'metal', color: 0xc9ced8 };

export default {
  id: 'coop7',
  name: 'Dinner Date',
  music: 'l1',
  deathRule: 'self',
  completeQuip: 'Seven courses. One bill. Zero compliments to the chef.',
  titleCam: { center: [0, 4, -60], radius: 34, height: 14 },

  build(w, game) {
    retreatEnv(w, { mood: 'dusk' });
    lake(w, -34);
    const c = w.coop, me = c.me, N = c.names, P = c.partner;
    w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: 5, yaw: 0 };
    w.respawn = { ...w.spawn };
    const tell = (r, k, o) => c.tell(r, k, o);
    const K = carryKit(w);
    const S = stepsFor(w, K);
    const bots = { p1: [], p2: [] };
    const both = (...s) => { bots.p1.push(...s); bots.p2.push(...s); };
    const planks = (x, y, z, ww, d, o = {}) => deck(w, { x, y, z, w: ww, d, ...FLOOR, ...o });
    /** A kitchen counter: solid, 1 m tall (or `h`), steel top. */
    const counter = (x, z, ww, d, o = {}) => w.plat({ x, y: (o.y0 ?? 0) + (o.h ?? 1), z, w: ww, d, h: o.h ?? 1, ...STEEL, ...(o.plat || {}) });
    const lit = (x, y, z) => lantern(w, x, y, z);
    const sgn = (t, x, y, z, o) => sign(w, t, x, y, z, o);
    const roleOnly = (who, t, x, y, z, o) => (who === me ? sign(w, t, x, y, z, { border: '#' + COL[who].toString(16).padStart(6, '0'), ...o }) : null);
    const partnerSteps = (a) => a;
    void partnerSteps; void riser; void beacon; void glowMaterial; void THREE; void lit;
    const G = {};      // gates by name
    const mark = (n) => { (window.__marks ||= {})[n] = [bots.p1.length, bots.p2.length]; };      // for JUMP='{"p1":i,"p2":j}' tests
    mark('s1');

    // ============================================================ 1. reservations + kitchen tutorial =====================
    planks(0, 0, -1, 24, 18, { path: true });                                           // z 8 … -10
    sgn('SERENITY FALLS · THE LAKESIDE BISTRO', 0, 6.4, 6, { w: 13, h: 1.6 });
    sgn('SESSION 7: DINNER DATE', 0, 4.7, 6, { w: 8.5, h: 1, border: '#39d7c9' });
    for (const lx of [-10, 10]) { lit(lx, 0, 4); lit(lx, 0, -8); }
    counter(0, -6.2, 8, 1.8);
    sgn('RESERVATIONS', 0, 3.4, -6.2, { w: 5, h: 0.9 });
    K.item('card', 'bill', 'card', { name: 'Reservation card' });
    K.station('card', { x: -2.2, y: 1, z: -6.2, label: 'Reservation card', approach: [-2.2, -4.2], accept: ['bill'] });
    K.station('podium', { x: 2.2, y: 1, z: -6.2, label: 'Reservation book', approach: [2.2, -4.2], accept: ['bill'], takeable: () => false, color: 0x39d7c9 });
    G.g1 = gate(w, { x: 0, z: -10.4, w: 24, h: 5 });
    sgn('A TABLE FOR TWO · PLEASE PUT YOUR CARD IN THE BOOK', 0, 6.2, -9.8, { w: 11, h: 1.2 });
    w.updaters.push(() => G.g1.set(!!K.at('podium')));
    stage(w, 'welcome', { x: 0, y: 1, z: 3, w: 30, h: 4, d: 8 }, () => { tell('p1', 'coop.l7.intro.p1', { priority: 2 }); tell('p2', 'coop.l7.intro.p2', { priority: 2 }); });
    stage(w, 'carry', { x: 0, y: 1, z: -3, w: 20, h: 4, d: 4 }, () => tell('all', 'coop.l7.carry'));
    c.onEvent('stage:booked', () => tell('all', 'coop.l7.booked'));
    stage(w, 'booked', { x: 0, y: 1, z: -9, w: 24, h: 4, d: 2 }, () => {});

    // the kitchen: china, three gaps, the pass
    planks(0, 0, -17.5, 24, 14.2, { path: true });                                      // z -10.4 … -24.6
    w.checkpoint({ x: 0, y: 0, z: -14, real: true });
    for (const lx of [-10, 10]) lit(lx, 0, -12);
    counter(-8, -13.5, 3.2, 1.6);
    K.item('china', 'china', 'china_home', { name: 'Fine china' });
    K.station('china_home', { x: -8, y: 1, z: -13.5, label: 'Fine china', approach: [-8, -11.6], accept: ['china'] });
    sgn('FINE CHINA · DO NOT JUMP WITH IT', -8, 3.6, -13.5, { w: 5.4, h: 0.9, border: '#ff4d5e' });
    const GAP = 2.2;
    const gz = [-24.6 - GAP, -24.6 - GAP - 6 - GAP, -24.6 - 2 * (GAP + 6) - GAP];                                   // near edges of the three islands
    const dd = [6, 6, 8];
    gz.forEach((z0, i) => planks(0, 0, z0 - dd[i] / 2, 10, dd[i], { path: true }));
    sgn('MIND THE GAP · THE PLATE CANNOT', 0, 3.4, -24.6, { w: 6.4, h: 0.9 });
    const lastD = gz[2] - 8;                                                              // island 3 is 8 deep
    counter(0, lastD + 0.9, 4, 1.4);
    K.station('pass1', { x: 0, y: 1, z: lastD + 0.9, label: 'The pass', approach: [0, lastD + 2.6], accept: ['china'], takeable: () => false, color: 0x39d7c9 });
    sgn('THE PASS · ORDER UP', 0, 3.4, lastD + 0.9, { w: 4.4, h: 0.9 });
    G.g2 = gate(w, { x: 0, z: lastD - 0.4, w: 10, h: 5 });
    w.updaters.push(() => G.g2.set(!!K.at('pass1')));
    w.checkpoint({ x: 0, y: 0, z: gz[1] - 3, real: true });
    stage(w, 'gaps', { x: 0, y: 1, z: -23, w: 20, h: 4, d: 3 }, () => tell('all', 'coop.l7.gaps'));
    stage(w, 'gap3', { x: 0, y: 1, z: gz[2] - 3, w: 10, h: 4, d: 4 }, () => tell('all', 'coop.l7.gap3'));
    K.onBreak = (it, why) => { if (it.id === 'china') tell('all', 'coop.l7.chinabreak'); else if (it.id === 'souffle') tell('all', why === 'crush' ? 'coop.l7.hatchcrush' : 'coop.l7.soufflebreak'); else if (why === 'spill') tell('all', 'coop.l7.spill'); else if (why === 'crush') tell('all', 'coop.l7.crush'); else tell('all', 'coop.l7.smash'); };

    // bots, stage 1. Gap 1: p1 gives (K0 edge) p2 receives; gap 2: p2 gives, p1 receives; gap 3: p1 gives, p2 receives and serves.
    const e0 = -24.6, e1 = gz[0] - 6, e2 = gz[1] - 6;                                  // far edges of the islands 0..2
    const stand = (z, lead = 0.55) => z + lead;
    bots.p1.push(
      S.take('card'), S.put('podium'),
      { x: 0, z: -14, until: () => !!K.at('podium') && G.g1.passable },
      S.take('china_home', 'china'),
      { x: -4, z: -11.8, r: 0.6 },
      { x: 1.5, z: e0 + 1.2, r: 0.4, until: () => P.has && P.sz < e0 - 2.4 },                           // wait at the edge until p2 is across
      { x: 1.5, z: e0 + 1.2, r: 0.4, face: [() => P.sx, () => P.sz], use: true, until: () => !K.held() },       // hand it over the gap
      { x: -2, z: gz[0] - 3, jump: 3.6 },                                                // hop across
      { x: -2, z: gz[1] - 1.2, jump: 3.6 },                                               // and across the second gap (no china)
      { x: 1.5, z: stand(gz[1] - 2.2, 0), r: 0.5, until: () => !!K.held() },             // receive the china on island 2's near edge
      { x: 1.5, z: e2 + 1.2, r: 0.4 },
      { x: 1.5, z: e2 + 1.2, r: 0.4, until: () => P.has && P.sz < e2 - 2.4 },
      { x: 1.5, z: e2 + 1.2, r: 0.4, face: [() => P.sx, () => P.sz], use: true, until: () => !K.held() },
      { x: -2, z: gz[2] - 3, jump: 3.6 },
    );
    bots.p2.push(
      { until: () => G.g1.passable },
      { x: -2, z: gz[0] - 1.2, jump: 3.6 },
      { x: 1.5, z: gz[0] - 1.0, r: 0.4, until: () => !!K.held() },                         // receive on island 1's near edge
      { x: 1.5, z: e1 + 1.2, r: 0.4 },
      { x: 1.5, z: e1 + 1.2, r: 0.4, until: () => P.has && P.sz < e1 - 2.4 },
      { x: 1.5, z: e1 + 1.2, r: 0.4, face: [() => P.sx, () => P.sz], use: true, until: () => !K.held() },
      { x: -2, z: gz[1] - 4.5, jump: 3.6 },
      { x: -2, z: gz[2] - 1.2, jump: 3.6 },                                              // on to island 3 (empty-handed)
      { x: 1.5, z: gz[2] - 1.0, r: 0.4, until: () => !!K.held() },
      S.put('pass1'),
    );

    // ============================================================ 2. appetisers: load, chill, catch ===========================
    const z0 = lastD - 0.8;                                                              // F0 starts here (the gate sits at lastD - 0.4)
    planks(0, 0, z0 - 7.7, 24, 15.4, { path: true });                                    // the loading dock
    for (const lx of [-10, 10]) lit(lx, 0, z0 - 2);
    const trayAt = [[-9, z0 - 4.5], [9, z0 - 8], [-9, z0 - 11.5]];
    ['a', 'b', 'c'].forEach((n, i) => {
      counter(trayAt[i][0], trayAt[i][1], 3, 1.4);
      K.item('tray_' + n, 'tray', 'tray_' + n, { name: 'Canapé tray ' + n.toUpperCase() });
      K.station('tray_' + n, { x: trayAt[i][0], y: 1, z: trayAt[i][1], label: 'Canapé tray', accept: ['tray'] });
    });
    sgn('CANAPÉS · TRAYS ONLY', 0, 4.6, z0 - 1.5, { w: 6, h: 1 });
    const zH = z0 - 14.8, zE = z0 - 33.6;                                                // belt head and end
    counter(0, zH, 4, 1.2);
    K.station('belt_head', { x: 0, y: 1, z: zH, label: 'The belt', belt: 'main', approach: [0, zH + 1.7], accept: ['tray'], color: 0x39d7c9 });
    K.belt('main', { a: [0, 1, zH], b: [0, 1, zE], speed: 2.4, end: 'belt_end', doors: [{ d: 9.0, open: (t) => (t % 7) < 3.2 }] });
    K.beltBusy = () => ['a', 'b', 'c'].some((n) => String(K.holder('tray_' + n))[0] === 'b');
    // the belt: a steel runner over the chasm with ribs that crawl along it
    w.box({ x: 0, y: 0.82, z: (zH + zE) / 2, w: 1.1, h: 0.14, d: Math.abs(zH - zE), tex: 'metal', color: 0x4a4f5c });
    const ribs = [];
    for (let i = 0; i < 20; i++) { const r = w.box({ x: 0, y: 0.91, z: 0, w: 1.0, h: 0.04, d: 0.12, color: 0xd8a94a, static: false }); ribs.push(r); }
    w.updaters.push(() => { const L = Math.abs(zH - zE), sp = 2.4; for (let i = 0; i < ribs.length; i++) { const u = (((i / ribs.length) * L + w.t * sp) % L); ribs[i].position.z = zH - u; } });
    for (let i = 0; i <= 6; i++) w.box({ x: 0, y: -4, z: zH - 3 * i - 1, w: 0.25, h: 9, d: 0.25, color: 0x3a3f4b });
    // the chiller door: a blade that comes down over the belt. Lamp: green = go, amber = closing, red = shut.
    const zD = zH - 9.0;
    for (const sx of [-1, 1]) w.box({ x: sx * 1.35, y: 2.2, z: zD, w: 0.3, h: 3.4, d: 0.5, color: 0x6b717f });
    w.box({ x: 0, y: 3.95, z: zD, w: 3.0, h: 0.35, d: 0.5, color: 0x6b717f });
    const blade = w.box({ x: 0, y: 3.0, z: zD, w: 2.4, h: 1.5, d: 0.2, glow: 0x7fd4ff, glowIntensity: 0.8, static: false });
    const lampD = w.box({ x: 1.35, y: 3.8, z: zD + 0.4, w: 0.4, h: 0.4, d: 0.2, glow: 0x3ddc97, static: false });
    const phase = (t) => ((t % 7) + 7) % 7;
    sgn('BLAST CHILLER · KEEP CLEAR WHEN RED', 0, 5.2, zD, { w: 6.4, h: 0.9, border: '#7fd4ff' });
    const headLamp = w.box({ x: 2.1, y: 2.9, z: zH, w: 0.6, h: 0.6, d: 0.3, glow: 0x3ddc97, static: false });
    sgn('LOAD ON GREEN', 2.1, 3.6, zH, { w: 3.0, h: 0.6, size: 40, border: '#3ddc97' });
    w.updaters.push(() => {
      const ph = phase(w.t);
      const k = ph < 2.9 ? 0 : ph < 3.2 ? (ph - 2.9) / 0.3 : ph < 6.7 ? 1 : 1 - (ph - 6.7) / 0.3;     // 0 open … 1 closed
      blade.position.y = 3.1 - k * 1.75;
      lampD.material.color.setHex(ph < 2.2 ? 0x3ddc97 : ph < 3.2 ? 0xffb43d : 0xff4d5e).multiplyScalar(2);
      const pa = phase(w.t + 9.0 / 2.4);
      headLamp.material.color.setHex(pa > 0.3 && pa < 2.5 ? 0x3ddc97 : 0xff4d5e).multiplyScalar(2);
    });
    const goodNow = () => { const pa = phase(w.t + 9.0 / 2.4); return pa > 0.5 && pa < 2.2; };
    // the catch side
    const F1z = z0 - 33;
    planks(0, 0, F1z - 7, 24, 14, { path: true });
    counter(0, zE, 4, 1.2);
    K.station('belt_end', { x: 0, y: 1, z: zE, label: 'The belt', approach: [0, zE - 1.7], accept: ['tray'], color: 0x39d7c9 });
    sgn('CATCH', 0, 3.4, zE, { w: 3, h: 0.7 });
    ['1', '2', '3'].forEach((n, i) => {
      const tx = (i - 1) * 7;
      counter(tx, F1z - 10, 3, 1.4);
      K.station('tbl' + n, { x: tx, y: 1, z: F1z - 10, label: 'Table ' + n, approach: [tx, F1z - 8.4], accept: ['tray'], takeable: () => false, color: 0x39d7c9 });
    });
    sgn('THREE TABLES · THREE TRAYS', 0, 4.4, F1z - 10, { w: 7, h: 1 });
    for (const lx of [-10, 10]) lit(lx, 0, F1z - 3);
    // the bridge comes up when all three tables have their canapés
    const bridge = riser(w, { x: 0, y: 0, z: (zH - 0.6 + F1z) / 2, w: 6, d: Math.abs(zH - 0.6 - F1z), h: 1, drop: 8, speed: 7, tex: 'wood', path: true });
    let tabled = 0;
    w.updaters.push(() => { tabled = ['1', '2', '3'].filter((n) => K.at('tbl' + n)).length; bridge.set(tabled >= 3); });
    // stepping stones along the east side: the catcher's way across
    const stones = [];
    for (let i = 0; i < 4; i++) stones.push(planks(9.5, 0, z0 - 18.5 - 4.2 * i, 2.8, 2.6, { path: 'stones' }));
    w.crumble(stones[1], { delay: 1.2, gone: 3 }); w.crumble(stones[3], { delay: 1.2, gone: 3 });
    sgn('THE LONG WAY ROUND (NO TRAYS)', 9.5, 3.2, z0 - 15.6, { w: 5.6, h: 0.8 });
    w.checkpoint({ x: 0, y: 0, z: z0 - 8, real: true });
    w.checkpoint({ x: 0, y: 0, z: F1z - 4, real: true });
    stage(w, 'belt', { x: 0, y: 1, z: z0 - 5, w: 24, h: 4, d: 4 }, () => tell('all', 'coop.l7.belt'));
    stage(w, 'chiller', { x: 0, y: 1, z: zH + 2, w: 12, h: 4, d: 4 }, () => tell('all', 'coop.l7.chiller'));
    stage(w, 'catcher', { x: 0, y: 1, z: F1z - 3, w: 24, h: 4, d: 4 }, () => { tell('all', 'coop.l7.catcher'); });
    let bridgedSaid = false;
    w.updaters.push(() => { if (!bridgedSaid && bridge.k > 0.95) { bridgedSaid = true; tell('all', 'coop.l7.bridged'); } });
    let said1 = false;
    w.updaters.push(() => { if (!said1 && tabled >= 1) { said1 = true; tell('all', 'coop.l7.firsttray'); } });
    G.g3 = gate(w, { x: 0, z: F1z - 14.4, w: 24, h: 5 });
    w.updaters.push(() => G.g3.set(bridge.k > 0.95));
    sgn('KITCHEN · STAFF ONLY · (THAT IS YOU)', 0, 6.2, F1z - 13.8, { w: 11, h: 1.2 });

    mark('s2');
    bots.p1.push(
      { follow: true, until: () => G.g2.passable && game.player.z < z0 - 2 },
      ...['a', 'b', 'c'].flatMap((n, i) => [
        S.take('tray_' + n),
        { x: 0, z: zH + 1.7, r: 0.5, until: () => goodNow() && !K.at('belt_end') && !K.beltBusy() && (i === 0 || !!K.at('tbl' + i)) },
        S.put('belt_head'),
        { x: 0, z: zH + 3.0, r: 0.8 },
      ]),
      { x: 0, z: zH + 1.7, r: 0.5, until: () => bridge.k > 0.97 },
      { x: 0, z: F1z - 4, r: 1.5 },
    );
    bots.p2.push(
      { follow: true, until: () => G.g2.passable && game.player.z < z0 - 2 },
      { x: 9.5, z: z0 - 12, r: 0.8 },
      ...stones.map((st) => ({ x: 9.5, z: st.body.z, jump: 3.4, r: 0.7 })),
      { x: 9.5, z: F1z - 2.5, jump: 3.4, r: 0.8 },
      ...['1', '2', '3'].flatMap((n) => [
        { x: 0, z: zE - 1.7, r: 0.5, until: () => !!K.at('belt_end') },
        S.take('belt_end'),
        S.put('tbl' + n),
      ]),
      { x: 0, z: F1z - 4, r: 1.5 },
    );
    const z3a = F1z - 14.8;
    both({ x: 0, z: F1z - 12.5, r: 1.2, until: () => G.g3.passable }, { x: 0, z: z3a - 3, r: 1.5 });

    // ============================================================ 3. the walk-in freezer: hold the door, fetch the ice =========
    planks(0, 0, z3a - 11, 24, 22, { path: true });                                      // the cold hall
    w.checkpoint({ x: 0, y: 0, z: z3a - 3, real: true });
    for (const lx of [-10, 10]) { lit(lx, 0, z3a - 2); lit(lx, 0, z3a - 20); }
    const ICE = { tex: 'metal', color: 0xcfe8ff };
    const walls = [];
    const wall = (x, z, ww, d) => walls.push(w.plat({ x, y: 5, z, w: ww, d, h: 5, ...ICE }));
    const freezer = (side, depth, plateAt, who, id, itemName) => {
      const sx = side, x1 = sx * 12, x2 = sx * (12 + depth), cx = (x1 + x2) / 2;
      planks(cx, 0, z3a - 10, depth, 12, { color: 0xcfe8ff, tex: 'metal' });
      wall(x2 + sx * 0.4, z3a - 10, 0.8, 13.6);
      wall(cx, z3a - 3.6, depth + 0.8, 0.8);
      wall(cx, z3a - 16.4, depth + 0.8, 0.8);
      wall(x1, z3a - 5.5, 0.8, 3.0); wall(x1, z3a - 14.5, 0.8, 3.0);
      const door = gate(w, { x: x1, z: z3a - 10, w: 0.8, d: 6, h: 5, color: 0xdfeefc, tex: 'metal', glow: 0x7fd4ff });
      const pl = plate(w, { x: sx * 8, y: 0, z: plateAt, need: who, hold: 1.0, label: `${N[who]}: HOLD THE DOOR` });
      counter(sx * (12 + depth - 2), z3a - 10, 2.6, 2.6, { plat: { color: 0xcfe8ff } });
      K.item(id, 'crate', id + '_home', { name: itemName, color: 0x9fd8ff });
      K.station(id + '_home', { x: sx * (12 + depth - 2), y: 1, z: z3a - 10, label: itemName, approach: [sx * (12 + depth - 4.2), z3a - 10], accept: ['crate'], color: 0x7fd4ff });
      sgn('WALK-IN FREEZER · -18°C', sx * 12, 6.8, z3a - 10, { w: 6.5, h: 1.0, border: '#7fd4ff', rotY: Math.PI / 2 * -sx });
      w.light(0x9fd8ff, 6, 14, cx, 3.6, z3a - 10);
      w.updaters.push(() => door.set(pl.pressed));
      return { door, pl, x1, x2, sx };
    };
    const FA = freezer(-1, 14, z3a - 4.6, 'p2', 'iceA', 'Block of ice (A)');
    const FB = freezer(1, 18, z3a - 15.4, 'p1', 'iceB', 'Block of ice (B)');
    counter(-3, z3a - 19.4, 3, 1.4); counter(3, z3a - 19.4, 3, 1.4);
    K.station('svcA', { x: -3, y: 1, z: z3a - 19.4, label: 'Service counter', approach: [-3, z3a - 17.8], accept: (it) => it.id === 'iceA', takeable: () => false, color: 0x7fd4ff });
    K.station('svcB', { x: 3, y: 1, z: z3a - 19.4, label: 'Service counter', approach: [3, z3a - 17.8], accept: (it) => it.id === 'iceB', takeable: () => false, color: 0x7fd4ff });
    sgn('A + B · ICE FOR THE TABLE', 0, 4.4, z3a - 19.4, { w: 7, h: 1 });
    G.g4 = gate(w, { x: 0, z: z3a - 21.6, w: 24, h: 5 });
    w.updaters.push(() => G.g4.set(!!K.at('svcA') && !!K.at('svcB')));
    // the cold: a bar that fills while you are inside; it drains fast outside. Full = frozen stiff.
    const coldBar = K.bar('cold', { label: 'COLD', color: '#7fd4ff' });
    let cold = 0;
    const inside = (F) => { const p = game.player; return p.z < z3a - 3.4 && p.z > z3a - 16.6 && ((F.sx < 0 && p.x < F.x1 - 0.5 && p.x > F.x2 - 1) || (F.sx > 0 && p.x > F.x1 + 0.5 && p.x < F.x2 + 1)); };
    w.updaters.push((dt) => {
      if (game.state !== 'playing') { cold = 0; return; }
      const ins = inside(FA) || inside(FB);
      cold = Math.max(0, Math.min(1.2, cold + (ins ? dt / 13 : -dt / 2.2)));
      coldBar.show(cold > 0.02); coldBar.set(1 - cold, cold > 0.7 ? 'FREEZING!' : 'COLD', cold > 0.7 ? '#ff4d5e' : '#7fd4ff');
      if (cold >= 1) { cold = 0; game.kill('freeze'); }
    });
    stage(w, 'freezers', { x: 0, y: 1, z: z3a - 4, w: 24, h: 4, d: 4 }, () => { tell('p1', 'coop.l7.freezer.p1'); tell('p2', 'coop.l7.freezer.p2'); });
    stage(w, 'freezer2', { x: 0, y: 1, z: z3a - 12, w: 6, h: 4, d: 20 }, () => {});
    let ice1 = false, ice2 = false;
    w.updaters.push(() => {
      if (!ice1 && K.at('svcA')) { ice1 = true; tell('all', 'coop.l7.ice1'); }
      if (!ice2 && K.at('svcB')) { ice2 = true; tell('all', 'coop.l7.ice2'); }
    });
    mark('s3');
    bots.p2.push(
      { x: -8, z: z3a - 4.6, r: 0.4, until: () => !!K.at('svcA') },
      { x: FB.x1 + 4, z: z3a - 10, r: 1.0, until: () => FB.door.passable },
      S.take('iceB_home', 'iceB'),
      { x: 8, z: z3a - 10, r: 1.0 },
      S.put('svcB'),
    );
    bots.p1.push(
      { x: -6, z: z3a - 10, r: 1.0, until: () => FA.door.passable },
      S.take('iceA_home', 'iceA'),
      { x: -6, z: z3a - 10, r: 1.0 },
      S.put('svcA'),
      { x: 8, z: z3a - 15.4, r: 0.4, until: () => !!K.at('svcB') },
    );
    both({ x: 0, z: z3a - 19.4 + 2.5, r: 1.2, until: () => G.g4.passable });
    const zp = z3a - 22.4;

    // ============================================================ 4. soup: stir, ladle, don't slosh ============================
    planks(0, 0, zp - 7, 24, 14, { path: true });                                        // the pot room
    w.checkpoint({ x: 0, y: 0, z: zp - 2, real: true });
    for (const lx of [-10, 10]) lit(lx, 0, zp - 2);
    counter(-4, zp - 5, 3.2, 1.6); counter(4, zp - 5, 3.2, 1.6);
    ['A', 'B'].forEach((n, i) => {
      const sx = i ? 4 : -4;
      K.item('soup' + n, 'soup', 'soup' + n + '_home', { name: 'Bowl of soup', accel: 0.011 });
      K.station('soup' + n + '_home', { x: sx, y: 1, z: zp - 5, label: 'Soup', accept: ['soup'], color: 0xe8a23c, takeable: () => stir.theirs });
    });
    const stir = plate(w, { x: 0, y: 0, z: zp - 9, size: 2.4, need: 'any', label: 'STIR THE POT' });
    const potM = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 1.1, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x8e949f, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }));
    potM.position.set(0, 0.55, zp - 11.5); w.add(potM);
    const soupTop = new THREE.Mesh(new THREE.CircleGeometry(1.0, 20), new THREE.MeshStandardMaterial({ color: 0xe8a23c, emissive: 0x442200, emissiveIntensity: 0.6 }));
    soupTop.rotation.x = -Math.PI / 2; soupTop.position.set(0, 0.95, zp - 11.5); w.add(soupTop);
    sgn('THE POT NEEDS STIRRING · THE OTHER ONE LADLES', 0, 4.3, zp - 9, { w: 9, h: 1.1 });
    sgn('SOUP · DON\'T SLOSH', 0, 4.3, zp - 5, { w: 4.4, h: 0.8 });
    K.slosh = (() => { let tz = null; return () => { const gr = game.player.ground; if (gr && gr.tag === 'trolley') { const mv = tz !== null && Math.abs(gr.z - tz) > 1e-4; tz = gr.z; return mv ? 0.05 : 0; } tz = null; return 0; }; })();
    // the wet floor
    const wetZ = zp - 14;
    deck(w, { x: 0, y: 0, z: wetZ - 9, w: 12, d: 18, tex: 'tile', color: 0xb9d4e8, slippery: 1, path: true });
    for (const [px, pz] of [[-4, wetZ - 4], [4, wetZ - 9.5], [-4, wetZ - 14.5]]) w.plat({ x: px, y: 2.2, z: pz, w: 1.6, d: 1.6, h: 2.2, ...STEEL });
    sgn('WET FLOOR', 0, 3.6, wetZ - 0.6, { w: 4, h: 0.9, border: '#ffb43d' });
    sgn('SOUP SLOSHES WHEN YOU START, STOP, TURN OR JUMP. WATCH THE BAR.', 0, 5.4, wetZ - 0.6, { w: 9, h: 1.2 });
    const vz = wetZ - 18;                                                                // the warm island
    planks(0, 0, vz - 3, 12, 6, { path: true });
    counter(0, vz - 3.4, 3, 1.4);
    K.station('warmer', { x: 0, y: 1, z: vz - 3.4, label: 'Warmer', accept: ['soup'], refill: true, approach: [0, vz - 1.8], color: 0xffb43d });
    sgn('WARMER · PUT IT DOWN, PICK IT UP: FULL AGAIN', 0, 3.6, vz - 3.4, { w: 6.5, h: 0.9, border: '#ffb43d' });
    w.checkpoint({ x: 0, y: 0, z: vz - 1.2, real: true });
    // the trolleys
    const tz0 = vz - 6, TD = 4, TL = 11;
    const nearZ = tz0 - 0.3 - TD / 2, farEdge = tz0 - 0.3 - TD - TL - 0.3;
    const troA = w.plat({ x: -3.5, y: 0, z: nearZ, w: 4, d: TD, h: 0.6, tex: 'wood', color: 0xd9c9a0, tag: 'trolley', path: true });
    w.rollaway(troA, { dir: [0, -1], dist: TL, accel: 4, speed: 5, delay: 1.6, hold: 3.0, back: 2.0 });
    const troB = w.plat({ x: 3.5, y: 0, z: farEdge + 0.3 + TD / 2, w: 4, d: TD, h: 0.6, tex: 'wood', color: 0xd9c9a0, tag: 'trolley' });
    w.rollaway(troB, { dir: [0, 1], dist: TL, accel: 4, speed: 5, delay: 1.6, hold: 3.0, back: 2.0 });
    for (const t of [troA, troB]) for (const sx of [-1.7, 1.7]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0x222 })); wh.rotation.z = Math.PI / 2; wh.position.set(sx, -0.45, 0); t.group.add(wh); }
    sgn('TROLLEY · HOLD ON · IT ROLLS', -3.5, 3.4, tz0 - 0.6, { w: 4.4, h: 0.8 });
    sgn('RETURN TROLLEY', 3.5, 3.4, farEdge + 0.8, { w: 4.4, h: 0.8 });
    const nz = farEdge;                                                                  // dock where you deliver
    planks(0, 0, nz - 6.7, 14, 13.4, { path: true });
    counter(-3, nz - 9, 3, 1.4); counter(3, nz - 9, 3, 1.4);
    K.station('soupT1', { x: -3, y: 1, z: nz - 9, label: 'Table 4', accept: ['soup'], takeable: () => false, color: 0x39d7c9 });
    K.station('soupT2', { x: 3, y: 1, z: nz - 9, label: 'Table 5', accept: ['soup'], takeable: () => false, color: 0x39d7c9 });
    sgn('TWO BOWLS · TWO TABLES', 0, 4.4, nz - 9, { w: 7, h: 1 });
    w.checkpoint({ x: 0, y: 0, z: nz - 3, real: true });
    G.g5 = gate(w, { x: 0, z: nz - 13.8, w: 14, h: 5 });
    w.updaters.push(() => G.g5.set(!!K.at('soupT1') && !!K.at('soupT2')));
    stage(w, 'soup', { x: 0, y: 1, z: zp - 3, w: 24, h: 4, d: 5 }, () => tell('all', 'coop.l7.soup'));
    stage(w, 'wet', { x: 0, y: 1, z: wetZ - 1, w: 12, h: 4, d: 3 }, () => tell('all', 'coop.l7.wet'));
    stage(w, 'trolley', { x: 0, y: 1, z: vz - 4, w: 12, h: 4, d: 3 }, () => tell('all', 'coop.l7.trolley'));
    const prevOnPut = K.onPut;
    K.onPut = (id, item, who) => { prevOnPut?.(id, item, who); if (window.__bot) window.__bot.log.push(`put ${item} at ${id} sp=${K.sp(item).toFixed(2)}`); };
    let soupsDone = false;
    w.updaters.push(() => { if (!soupsDone && K.at('soupT1') && K.at('soupT2')) { soupsDone = true; tell('all', 'coop.l7.soupdone'); } });
    // bots: p1 ladles A while p2 stirs, then p2 ladles B while p1 stirs; both cross in their own lane; both ride the same trolley
    let warmA = false; c.onEvent('bot:warmA', () => { warmA = true; });
    const ride = (lane) => [
      { x: lane, z: vz - 1.0, r: 0.5 },
      { x: lane, z: vz - 5.0, r: 0.5 },
      { x: lane, z: vz - 5.0, r: 0.5, until: () => P.has && P.sz < vz - 3.0 },            // both wait at the front of the island, then board together
      { x: -3.5 + (lane < 0 ? -0.8 : 0.8), z: tz0 - 1.4, r: 0.7 },
      { x: -3.5 + (lane < 0 ? -0.8 : 0.8), z: nearZ, r: 99, until: () => troA.body.z < nearZ - TL + 0.6 },
      { x: lane, z: nz - 4, r: 1.0 },
    ];
    mark('s4');
    bots.p1.push(
      S.take('soupA_home', 'soupA'),
      { x: -1.2, z: zp - 3.0, r: 0.6 }, { x: 0, z: zp - 9, r: 0.4, until: () => K.holder('soupB') === 'p2' },
      { x: -1.2, z: zp - 3.0, r: 0.6 }, { x: -2.2, z: wetZ - 1.5, r: 0.8 }, { x: -2.2, z: vz - 0.8, r: 0.8 },
      S.put('warmer'), { ...S.take('warmer', 'soupA'), then: () => c.emit('bot:warmA') },
      ...ride(-2.2),
      S.put('soupT1'),
    );
    bots.p2.push(
      { x: 0, z: zp - 9, r: 0.4, until: () => K.holder('soupA') === 'p1' },
      S.take('soupB_home', 'soupB'),
      { x: 1.2, z: zp - 3.0, r: 0.6 }, { x: 2.2, z: wetZ - 1.5, r: 0.8 }, { x: 2.2, z: vz - 0.8, r: 0.8 },
      { x: 2.2, z: vz - 0.8, r: 0.8, until: () => warmA },
      S.put('warmer'), S.take('warmer', 'soupB'),
      ...ride(2.2),
      S.put('soupT2'),
    );
    both({ x: 0, z: nz - 11.4, r: 1.2, until: () => G.g5.passable }, { x: 0, z: nz - 16, r: 1.2 });
    const z5 = nz - 14.2;                                                                // where the chef's kitchen starts (the gate sits just before it)

    // ============================================================ 5. the chef: hold the noise, carry the herbs =================
    // d = distance into the kitchen, z = z5 - d.  South hall d 0..10, the aisle d 10..28 (x +-4, shelves either side), north hall d 28..40.
    const Z5 = (d) => z5 - d;
    planks(0, 0, Z5(5), 24, 10, { path: true });
    w.checkpoint({ x: 0, y: 0, z: Z5(3), real: true });
    for (const lx of [-10, 10]) { lit(lx, 0, Z5(2)); lit(lx, 0, Z5(37)); }
    const SHELF = { tex: 'wood', color: 0x9a7448 };
    const shelf = (x, d0, d1, ww) => w.plat({ x, y: 3, z: Z5((d0 + d1) / 2), w: ww, d: d1 - d0, h: 3, ...SHELF });
    planks(0, 0, Z5(19), 8, 18, { path: true });                                         // the aisle
    shelf(-8, 10, 28, 8); shelf(8, 10, 17, 8); shelf(8, 23, 28, 8);
    planks(8, 0, Z5(20), 8, 6, { color: 0xd7cfc0 });                                     // the service hatch the chef goes to
    sgn('SERVICE HATCH', 9.5, 3.4, Z5(20), { w: 4, h: 0.8, rotY: Math.PI / 2 * -1, border: '#ffb43d' });
    sgn('CHEF\'S AISLE · STAFF ONLY', 0, 5.4, Z5(10), { w: 7, h: 1, border: '#ff4d5e' });
    planks(0, 0, Z5(34), 24, 12, { path: true });                                        // the north hall
    w.checkpoint({ x: 0, y: 0, z: Z5(31), real: true });
    const chefBar = K.bar('chef', { label: 'SPOTTED!', color: '#ff4d5e' });
    const Chef = makeChef(w, {
      y: 0, speed: 2.1, len: 7, half: 0.6, bar: chefBar,
      path: [{ x: 0, z: Z5(12.5), wait: 1.4 }, { x: 0, z: Z5(27.5), wait: 1.4 }],
      lure: { x: 9, z: Z5(20), face: [1, 0] },
      occluders: [{ x0: -12, x1: -4, z0: Z5(28), z1: Z5(10) }, { x0: 4, x1: 12, z0: Z5(17), z1: Z5(10) }, { x0: 4, x1: 12, z0: Z5(28), z1: Z5(23) }],
      onSpot: () => tell('all', 'coop.l7.chefseen'),
    });
    const lureS = plate(w, { x: -9, y: 0, z: Z5(5), size: 2.4, need: 'any', label: 'CLATTER THE POTS · HOLD' });
    const lureN = plate(w, { x: -9, y: 0, z: Z5(34), size: 2.4, need: 'any', label: 'CLATTER THE POTS · HOLD' });
    w.updaters.push((dt) => Chef.hold(lureS.mine || lureN.mine, dt));
    counter(-5, Z5(9), 3.2, 1.6); counter(5, Z5(9), 3.2, 1.6);
    K.item('herb', 'crate', 'herb_home', { name: 'Fresh herbs', color: 0x4caf50 });
    K.item('garlic', 'crate', 'garlic_home', { name: 'Garlic', color: 0xf1e6c8 });
    K.station('herb_home', { x: -5, y: 1, z: Z5(9), label: 'Fresh herbs', approach: [-5, Z5(7.2)], accept: ['herb'] });
    K.station('garlic_home', { x: 5, y: 1, z: Z5(9), label: 'Garlic', approach: [5, Z5(7.2)], accept: ['garlic'] });
    sgn('PANTRY', 0, 3.6, Z5(9), { w: 4, h: 0.8 });
    counter(-6, Z5(36), 3.2, 1.6); counter(6, Z5(36), 3.2, 1.6);
    K.station('potA', { x: -6, y: 1, z: Z5(36), label: 'Stock pot', approach: [-6, Z5(34.4)], accept: ['herb'], takeable: () => false, color: 0x39d7c9 });
    K.station('potB', { x: 6, y: 1, z: Z5(36), label: 'Stock pot', approach: [6, Z5(34.4)], accept: ['garlic'], takeable: () => false, color: 0x39d7c9 });
    sgn('HERBS + GARLIC · IN THE POTS', 0, 4.4, Z5(36), { w: 8, h: 1 });
    G.g6 = gate(w, { x: 0, z: Z5(39.6), w: 24, h: 5 });
    w.updaters.push(() => G.g6.set(!!K.at('potA') && !!K.at('potB')));
    stage(w, 'chef1', { x: 0, y: 1, z: Z5(3), w: 24, h: 4, d: 4 }, () => tell('all', 'coop.l7.chef'));
    stage(w, 'chef2', { x: 0, y: 1, z: Z5(6), w: 6, h: 4, d: 3 }, () => tell('all', 'coop.l7.chefcone'));
    let lureSaid = false;
    w.updaters.push(() => { if (!lureSaid && Chef.mode === 'at') { lureSaid = true; tell('all', 'coop.l7.chefaway'); } });
    stage(w, 'chef3', { x: 0, y: 1, z: Z5(30), w: 24, h: 4, d: 3 }, () => tell('all', 'coop.l7.chefswap'));
    let potsSaid = false;
    w.updaters.push(() => { if (!potsSaid && K.at('potA') && K.at('potB')) { potsSaid = true; tell('all', 'coop.l7.chefdone'); } });
    mark('s5');
    bots.p1.push(
      S.take('herb_home', 'herb'),
      { x: 0, z: Z5(8.6), r: 0.8 },
      { x: 0, z: Z5(8.6), r: 0.8, until: () => Chef.mode === 'at' },
      { x: 0, z: Z5(29.5), r: 1.0 },
      { x: -9, z: Z5(34), r: 0.6 },
      { x: -9, z: Z5(34), r: 0.6, until: () => P.has && P.sz < Z5(30.5) },
      S.put('potA'),
    );
    bots.p2.push(
      S.take('garlic_home', 'garlic'),
      { x: -9, z: Z5(5), r: 0.5 },
      { x: -9, z: Z5(5), r: 0.5, until: () => P.has && P.sz < Z5(32) },
      { x: 0, z: Z5(8.6), r: 0.8 },
      { x: 0, z: Z5(8.6), r: 0.8, until: () => Chef.mode === 'at' },
      { x: 0, z: Z5(29.5), r: 1.0 },
      S.put('potB'),
    );
    both({ x: 0, z: Z5(37.6), r: 1.2, until: () => G.g6.passable }, { x: 0, z: Z5(42), r: 1.5 });
    const z6 = Z5(40);                                                                   // the main-course kitchen starts here
    const Z6 = (d) => z6 - d;

    // ============================================================ 6. main course: the ticket, the glossary, one pan ===========
    // Two rounds. In each round ONE of you can read the ticket (ingredient NAMES in order) and the OTHER can read the glossary
    // (which COLOUR is which name; a new glossary every round). Put the right colours into the pan in order; a wrong one burns the pan
    // (it flares, everything goes back to its shelf, nothing worse). Round 1 reader: p1. Round 2 reader: p2.
    planks(0, 0, Z6(16), 24, 32, { path: true });
    w.checkpoint({ x: 0, y: 0, z: Z6(3), real: true });
    for (const lx of [-10, 10]) { lit(lx, 0, Z6(2)); lit(lx, 0, Z6(30)); }
    const NAMES = ['FISH', 'LEMON', 'POTATO', 'THYME'];
    const CNAME = ['RED', 'YELLOW', 'GREEN', 'BLUE'], CHEX = [0xe04848, 0xf5d33d, 0x4caf50, 0x4a8fe0];
    const shelfAt = [[-9.5, 6], [9.5, 6], [-9.5, 24], [9.5, 24]];                         // colour k lives here (d)
    const colorShelf = [2, 0, 3, 1];                                                       // which shelf spot holds which colour (fixed)
    CHEX.forEach((hex, k) => {
      const [sx, sd] = shelfAt[colorShelf[k]];
      counter(sx, Z6(sd), 3, 1.6);
      K.item('ing' + k, 'crate', 'ing' + k + '_home', { name: CNAME[k].toLowerCase() + ' ingredient', color: hex });
      K.station('ing' + k + '_home', { x: sx, y: 1, z: Z6(sd), label: CNAME[k] + ' ingredient', approach: [sx * 0.8, Z6(sd)], accept: ['crate'], color: hex });
      sgn(CNAME[k], sx, 3.6, Z6(sd), { w: 3, h: 0.8, border: '#' + hex.toString(16).padStart(6, '0'), size: 40 });
    });
    const recipes = [1, 2].map((r) => {
      const R = c.rng(7100 + r), seq = [];
      for (let i = 0; i < 3; i++) seq.push(Math.floor(R() * 4));
      if (seq[0] === seq[1] && seq[1] === seq[2]) seq[2] = (seq[2] + 1) % 4;
      const perm = [0, 1, 2, 3];                                                         // perm[nameIdx] = colour index
      for (let i = 3; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
      return { seq, perm, want: seq.map((n) => perm[n]), reader: r === 1 ? 'p1' : 'p2' };
    });
    // pan + plating counter + tables
    counter(0, Z6(14), 5, 2);
    K.station('pan', {
      x: 0, y: 1, z: Z6(14), label: 'The pan', approach: [0, Z6(12.2)], color: 0xff7a3d,
      accept: (it) => it.id.startsWith('ing'), takeable: () => false,
      onPut: (id) => {
        const R = curRound(), rc = recipes[R - 1], pan = c.get('pan');
        const step = pan && pan.round === R ? pan.step : 0, k = +id.slice(3);
        w.after(0.45, () => K.home(id));
        if (k === rc.want[step]) {
          c.set('pan', { round: R, step: step + 1, n: (pan?.n || 0) + 1 });
          if (step + 1 === 3) w.after(0.5, () => K.move('dish' + R, 'splateup', { sp: 1 }));
        } else { c.set('pan', { round: R, step: 0, n: (pan?.n || 0) + 1, burnt: true }); c.emit('pan:burn', { n: (pan?.n || 0) + 1 }); }
      },
    });
    counter(4.5, Z6(14), 2.2, 2);
    K.station('plateup', { x: 4.5, y: 1, z: Z6(14), label: 'The pass', approach: [4.5, Z6(12.2)], accept: ['dish'], color: 0x39d7c9 });
    [1, 2].forEach((r) => {
      const tx = r === 1 ? -5 : 5;
      K.item('dish' + r, 'dish', 'plateup', { name: 'Main course ' + r });
      K.items.get('dish' + r).init = { h: 'sgone' };
      counter(tx, Z6(28), 3.4, 1.6);
      K.station('table' + r, { x: tx, y: 1, z: Z6(28), label: 'Table ' + r, approach: [tx, Z6(26.4)], accept: (it) => it.id === 'dish' + r, takeable: () => false, color: 0x39d7c9 });
      sgn('TABLE ' + r, tx, 3.6, Z6(28), { w: 3.4, h: 0.8 });
    });
    const curRound = () => (K.at('table1') ? 2 : 1);
    const panStep = () => { const pan = c.get('pan'), R = curRound(); return pan && pan.round === R ? pan.step : 0; };
    G.g7 = gate(w, { x: 0, z: Z6(31.6), w: 24, h: 5 });
    w.updaters.push(() => G.g7.set(!!K.at('table1') && !!K.at('table2')));
    // the signs: ticket (reader), glossary (the other one), and what the wrong person sees instead
    const RC = (who) => '#' + COL[who].toString(16).padStart(6, '0');
    const sticket = [], sgloss = [], sblankT = [], sblankG = [];
    recipes.forEach((rc, i) => {
      const other = rc.reader === 'p1' ? 'p2' : 'p1';
      sticket.push(sgn('TICKET ' + (i + 1) + ' · ' + rc.seq.map((n) => NAMES[n]).join(' · '), 0, 5.0, Z6(14), { w: 9, h: 1.2, size: 38, border: RC(rc.reader) }));
      sblankT.push(sgn('TICKET ' + (i + 1) + ' · ONLY ' + N[rc.reader].toUpperCase() + ' CAN READ THIS', 0, 5.0, Z6(14), { w: 9, h: 1.2, size: 34, border: RC(rc.reader), color: '#9aa3b2' }));
      sgloss.push(sgn('GLOSSARY ' + (i + 1) + ' · ' + NAMES.map((nm, n) => nm + ' = ' + CNAME[rc.perm[n]]).join(' · '), 0, 5.0, Z6(6), { w: 13, h: 1.2, size: 30, border: RC(other) }));
      sblankG.push(sgn('GLOSSARY ' + (i + 1) + ' · ONLY ' + N[other].toUpperCase() + ' CAN READ THIS', 0, 5.0, Z6(6), { w: 13, h: 1.2, size: 34, border: RC(other), color: '#9aa3b2' }));
    });
    // progress dots over the pan
    const dots = [0, 1, 2].map((i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x000000 })); m.position.set((i - 1) * 0.7, 3.2, Z6(14)); w.add(m); return m; });
    let flash = 0;
    c.onEvent('pan:burn', () => { flash = 1; w.burst(new THREE.Vector3(0, 1.4, Z6(14)), 0xff5a2a, 26, 4); tell('all', 'coop.l7.burnt'); });
    let shownR = 0;
    w.updaters.push((dt) => {
      const R = curRound(), rc = recipes[R - 1], pan = c.get('pan'), done = K.at('table2') ? 3 : panStep();
      for (let i = 0; i < 2; i++) {
        const on = R === i + 1 && !K.at('table2');
        sticket[i].visible = on && me === recipes[i].reader; sblankT[i].visible = on && me !== recipes[i].reader;
        sgloss[i].visible = on && me !== recipes[i].reader; sblankG[i].visible = on && me === recipes[i].reader;
      }
      if (K.at('table2')) for (const m of [...sticket, ...sgloss, ...sblankT, ...sblankG]) m.visible = false;
      flash = Math.max(0, flash - dt * 1.6);
      dots.forEach((m, i) => {
        const filled = i < done && pan && (pan.round === R || K.at('table2'));
        const col = filled ? CHEX[rc.want[i]] : 0x333333;
        m.material.color.setHex(col); m.material.emissive.setHex(filled ? col : flash > 0 ? 0xff3a1a : 0x000000); m.material.emissiveIntensity = filled ? 0.8 : flash * 1.5;
      });
      if (R !== shownR) { shownR = R; if (R === 1) { tell(rc.reader, 'coop.l7.reader'); tell(rc.reader === 'p1' ? 'p2' : 'p1', 'coop.l7.fetcher'); } else { tell(rc.reader, 'coop.l7.reader2'); tell(rc.reader === 'p1' ? 'p2' : 'p1', 'coop.l7.fetcher2'); } }
    });
    stage(w, 'main1', { x: 0, y: 1, z: Z6(3), w: 24, h: 4, d: 4 }, () => tell('all', 'coop.l7.main'));
    let dishSaid = false;
    w.updaters.push(() => { if (!dishSaid && K.at('plateup')) { dishSaid = true; tell('all', 'coop.l7.dish1'); } });
    let mainDone = false;
    w.updaters.push(() => { if (!mainDone && K.at('table1') && K.at('table2')) { mainDone = true; tell('all', 'coop.l7.maindone'); } });
    // bots: the non-reader fetches (the reader bot waits); round 2 the other way round
    mark('s6');
    const lane = (sx) => (sx < 0 ? -5.3 : 7.0);
    const fetch = (r) => [
      ...recipes[r - 1].want.flatMap((col, k) => {
        const [sx, sd] = shelfAt[colorShelf[col]], north = sd > 14, ln = lane(sx);
        return [
          ...(north ? [{ x: ln, z: Z6(11), r: 0.6 }, { x: ln, z: Z6(17), r: 0.7 }] : []),
          S.take('ing' + col + '_home', 'ing' + col),
          ...(north ? [{ x: ln, z: Z6(17), r: 0.7 }, { x: ln, z: Z6(11), r: 0.6 }] : []),
          S.put('pan'), { x: 0, z: Z6(10.6), r: 0.6, until: () => panStep() > k },
        ];
      }),
      { x: 4.5, z: Z6(12.2), r: 0.5, until: () => !!K.at('plateup') },
      S.take('plateup', 'dish' + r), { x: 7.0, z: Z6(12), r: 0.6 }, { x: 7.0, z: Z6(18), r: 0.7 }, S.put('table' + r),
    ];
    bots.p2.push(...fetch(1), { x: 0, z: Z6(20), r: 1.5, until: () => !!K.at('table1') });
    bots.p1.push({ x: 0, z: Z6(20), r: 1.5, until: () => !!K.at('table1') }, ...fetch(2));
    bots.p2.push({ x: 0, z: Z6(20), r: 1.5, until: () => !!K.at('table2') });
    both({ x: 0, z: Z6(29.6), r: 1.2, until: () => G.g7.passable }, { x: 0, z: Z6(34), r: 1.5 });
    const z7 = Z6(32);                                                                   // the dessert tower starts here
    const Z7 = (d) => z7 - d;

    // ============================================================ 7. dessert tower: lift, hoist, the last gap ===================
    // F0 (y 0): the oven. The lift to F1 (y 4) is called from the TOP (a plate on F1). On F1 the souffle goes into the hoist, whose hatch only
    // stays open while someone holds a plate; the hoist climbs to F2 (y 8) while you take the stairs. The last gap is 2.8 m: hand it over.
    planks(0, 0, Z7(6), 24, 12, { path: true });
    w.checkpoint({ x: 0, y: 0, z: Z7(3), real: true });
    for (const lx of [-10, 10]) lit(lx, 0, Z7(2));
    sgn('DESSERT · A SOUFFLE · IT HAS NEVER BEEN JUMPED WITH', 0, 5.4, Z7(1), { w: 12, h: 1.2, border: '#f2c46b' });
    counter(-9, Z7(6), 3, 2);
    K.item('souffle', 'dessert', 'oven', { name: 'Souffle' });
    K.station('oven', { x: -9, y: 1, z: Z7(6), label: 'The oven', approach: [-7.2, Z7(6)], accept: ['dessert'], color: 0xf2c46b });
    sgn('THE OVEN', -9, 3.6, Z7(6), { w: 3, h: 0.8, border: '#f2c46b' });
    // the stairs (nobody carries anything up these)
    [1, 2, 3].forEach((k) => planks(10, k, Z7(3 + 2.2 * (k - 1)), 3, 2.2));
    planks(10, 4, Z7(12.25), 3, 7.5);
    sgn('STAIRS · FOR PEOPLE WITH FREE HANDS', 10, 5.6, Z7(2), { w: 5.4, h: 0.9, border: '#39d7c9' });
    // the lift (called from the top)
    const L1 = makeLift(w, { x: -6, z: Z7(14), w: 4, d: 4, y0: 0, y1: 4 });
    for (const [px, pz] of [[-8.3, 12.0], [-3.7, 12.0], [-8.3, 16.0], [-3.7, 16.0]]) w.box({ x: px, y: 3, z: Z7(pz), w: 0.25, h: 6.4, d: 0.25, color: 0x6b717f });
    sgn('SERVICE LIFT · CALLED FROM THE TOP', -6, 6.8, Z7(14), { w: 6, h: 1, border: '#3ddc97' });
    planks(0, 4, Z7(26), 24, 20, { path: true });                                        // F1, d 16 .. 36
    w.checkpoint({ x: 0, y: 4, z: Z7(18.5), real: true });
    for (const lx of [-10, 10]) lit(lx, 4, Z7(20));
    const callP = plate(w, { x: -6, y: 4, z: Z7(19.5), size: 2.4, need: 'any', label: 'CALL THE LIFT · HOLD' });
    w.updaters.push(() => L1.set(callP.pressed));
    counter(-9, Z7(27), 3, 2, { y0: 4 });
    counter(-9, Z7(32), 3, 2, { y0: 4 });
    K.station('oven1', { x: -9, y: 5, z: Z7(32), label: 'Spare oven', approach: [-7.2, Z7(32)], accept: ['dessert'], color: 0xf2c46b });
    sgn('SPARE OVEN', -9, 7.6, Z7(32), { w: 3, h: 0.8, border: '#f2c46b' });
    K.station('hoist_in', { x: -9, y: 5, z: Z7(27), label: 'The hoist', belt: 'hoist', approach: [-9, Z7(25.2)], accept: ['dessert'], color: 0x39d7c9 });
    sgn('HOIST · MIND THE HATCH', -9, 7.6, Z7(27), { w: 4, h: 0.8, border: '#39d7c9' });
    const HA = [-9, 5, Z7(27)], HB = [-9, 9, Z7(50)], hlen = Math.hypot(HB[1] - HA[1], HB[2] - HA[2]), hsp = 2.2, hdoor = 5.5;
    track(w, HA, HB, { speed: hsp });
    for (let i = 1; i <= 6; i++) { const u = i / 7; w.box({ x: -9, y: HA[1] + (HB[1] - HA[1]) * u - 2.6, z: HA[2] + (HB[2] - HA[2]) * u, w: 0.25, h: 5, d: 0.25, color: 0x3a3f4b }); }
    const doorP = plate(w, { x: -5, y: 4, z: Z7(30), size: 2.4, need: 'any', label: 'HOLD THE HATCH OPEN' });
    K.belt('hoist', { a: HA, b: HB, speed: hsp, end: 'hoist_out', doors: [{ d: hdoor, open: () => doorP.pressed }] });
    const hu = hdoor / hlen, hx = -9, hy = HA[1] + (HB[1] - HA[1]) * hu, hz = HA[2] + (HB[2] - HA[2]) * hu;
    for (const sx of [-1, 1]) w.box({ x: hx + sx * 1.0, y: hy + 0.7, z: hz, w: 0.22, h: 1.9, d: 0.4, color: 0x6b717f });
    w.box({ x: hx, y: hy + 1.7, z: hz, w: 2.2, h: 0.25, d: 0.4, color: 0x6b717f });
    const hatch = w.box({ x: hx, y: hy + 1.3, z: hz, w: 1.8, h: 0.9, d: 0.15, glow: 0x7fd4ff, glowIntensity: 0.8, static: false });
    const hatchLamp = w.box({ x: hx + 1.0, y: hy + 2.0, z: hz + 0.4, w: 0.35, h: 0.35, d: 0.2, glow: 0x3ddc97, static: false });
    w.updaters.push((dt) => {
      const open = doorP.pressed, ty = open ? hy + 1.3 : hy + 0.55;
      hatch.position.y += (ty - hatch.position.y) * Math.min(1, dt * 8);
      hatchLamp.material.color.setHex(open ? 0x3ddc97 : 0xff4d5e).multiplyScalar(2);
    });
    // up to F2: stairs on the east side
    [1, 2, 3].forEach((k) => planks(10, 4 + k, Z7(36 + 1.1 + 2.2 * (k - 1)), 3, 2.2));
    planks(10, 8, Z7(44.8), 3, 4.4);
    for (const lx of [-10, 10]) lit(lx, 4, Z7(34));
    planks(0, 8, Z7(53), 24, 12, { path: true });                                        // F2, d 47 .. 59
    w.checkpoint({ x: 0, y: 8, z: Z7(49), real: true });
    for (const lx of [-10, 10]) lit(lx, 8, Z7(49));
    counter(-9, Z7(51), 3, 2, { y0: 8 });
    K.station('hoist_out', { x: -9, y: 9, z: Z7(51), label: 'The hoist', approach: [-7.2, Z7(51)], accept: ['dessert'], color: 0x39d7c9 });
    counter(-9, Z7(55), 3, 2, { y0: 8 });
    K.station('oven2', { x: -9, y: 9, z: Z7(55), label: 'Spare oven', approach: [-7.2, Z7(55)], accept: ['dessert'], color: 0xf2c46b });
    sgn('SPARE OVEN', -9, 11.6, Z7(55), { w: 3, h: 0.8, border: '#f2c46b' });
    // the spare ovens: if the souffle breaks, it comes back at the highest oven it has reached
    let reached = 0;
    w.updaters.push(() => {
      const it = K.items.get('souffle'), h = K.holder('souffle');
      const y = h === me ? game.player.y : h === c.other ? P.sy : null;
      if (h === 'shoist_out' || (y !== null && y > 7.5)) reached = Math.max(reached, 2);
      else if (h === 'shoist_in' || h === 'bhoist' || (y !== null && y > 3.5)) reached = Math.max(reached, 1);
      it.home = ['oven', 'oven1', 'oven2'][reached];
    });
    // the last gap
    const T = planks(0, 9, Z7(66.3), 14, 9, { path: true });                              // d 61.8 .. 70.8
    sgn('THE PASS · THE TABLE IS NOT FAR · THE GAP IS 2.8 M', 0, 14.0, Z7(60), { w: 12, h: 1.3, border: '#ffb43d' });
    w.checkpoint({ x: 0, y: 9, z: Z7(63.3), real: true });
    counter(0, Z7(68), 4, 1.6, { y0: 9 });
    K.station('dtable', { x: 0, y: 10, z: Z7(68), label: 'The dessert table', approach: [0, Z7(66.4)], accept: ['dessert'], takeable: () => false, color: 0x39d7c9 });
    stage(w, 'dessert', { x: 0, y: 1, z: Z7(4), w: 24, h: 4, d: 6 }, () => tell('all', 'coop.l7.dessert'));
    stage(w, 'lift', { x: -6, y: 1, z: Z7(10), w: 6, h: 4, d: 4 }, () => tell('all', 'coop.l7.lift'));
    stage(w, 'f1', { x: 0, y: 5, z: Z7(21), w: 24, h: 4, d: 4 }, () => tell('all', 'coop.l7.f1'));
    stage(w, 'f2', { x: 0, y: 9, z: Z7(50), w: 24, h: 4, d: 4 }, () => tell('all', 'coop.l7.f2'));
    stage(w, 'gap', { x: 0, y: 9, z: Z7(57), w: 14, h: 4, d: 3 }, () => tell('all', 'coop.l7.lastgap'));
    let served = false;
    w.updaters.push(() => { if (!served && K.at('dtable')) { served = true; tell('all', 'coop.l7.served'); } });
    mark('s7');
    const beltDist = () => { const s = c.get('it:souffle'); return s && s.h === 'bhoist' ? hsp * (w.t - s.a.t0) : 0; };
    bots.p1.push(
      S.take('oven', 'souffle'),
      { x: -6, z: Z7(10.6), r: 0.6 },
      { x: -6, z: Z7(14), r: 0.7, until: () => L1.atTop },
      { x: -6, z: Z7(17.5), r: 0.6 },
      { x: -5.5, z: Z7(25.2), r: 0.6 }, { x: -9, z: Z7(25.2), r: 0.5 },
      { x: -9, z: Z7(25.2), r: 0.5, until: () => doorP.pressed },
      S.put('hoist_in'),
      { x: 10, z: Z7(35), r: 0.8 }, { x: 10, z: Z7(37.1), r: 0.6 }, { x: 10, z: Z7(39.3), r: 0.6 }, { x: 10, z: Z7(41.5), r: 0.6 }, { x: 10, z: Z7(44.8), r: 0.6 }, { x: 10, z: Z7(48.5), r: 0.8 },
      { x: -7.2, z: Z7(51), r: 0.6 },
      S.take('hoist_out', 'souffle'),
      { x: 3, z: Z7(58.4), r: 0.4 },
      { x: 3, z: Z7(58.4), r: 0.4, until: () => P.has && P.sy > 8.5 && P.sz < Z7(61.5) },
      { x: 3, z: Z7(58.4), r: 0.4, face: [() => P.sx, () => P.sz], use: true, until: () => !K.held() },
      { x: 3, z: Z7(63.3), jump: 5.0, r: 0.8 },
    );
    bots.p2.push(
      { x: 10, z: Z7(3), r: 0.8 }, { x: 10, z: Z7(5.2), r: 0.6 }, { x: 10, z: Z7(7.4), r: 0.6 }, { x: 10, z: Z7(12.25), r: 0.6 }, { x: 10, z: Z7(17), r: 0.8 },
      { x: -6, z: Z7(19.5), r: 0.5 },
      { x: -6, z: Z7(19.5), r: 0.5, until: () => P.has && P.sy > 3.5 && P.sz < Z7(17) },
      { x: -5, z: Z7(30), r: 0.5 },
      { x: -5, z: Z7(30), r: 0.5, until: () => beltDist() > hdoor + 1.2 },
      { x: 10, z: Z7(35), r: 0.8 }, { x: 10, z: Z7(37.1), r: 0.6 }, { x: 10, z: Z7(39.3), r: 0.6 }, { x: 10, z: Z7(41.5), r: 0.6 }, { x: 10, z: Z7(44.8), r: 0.6 }, { x: 10, z: Z7(48.5), r: 0.8 },
      { x: 3, z: Z7(55), r: 0.6 },
      { x: 3, z: Z7(63.3), jump: 5.0, r: 0.6 },
      { x: 3, z: Z7(62.6), r: 0.5, until: () => K.holder('souffle') === 'p2' },
      S.put('dtable'),
    );
    // ============================================================ 8. the bill: a finish line that is not, then the back stairs ==
    // "Bill please" is a very convincing finish. It is not. The bill is a document: carry it down the back stairs to the cashier, then
    // each of you pays your half (your own plate, at the same time), and the exit opens for a few seconds.
    const fakeRing = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.14, 12, 48), glowMaterial(0x3ddc97, 2));
    fakeRing.position.set(0, 9 + 2.4, Z7(70.1)); w.add(fakeRing);
    const fakeSign = sgn('BILL PLEASE · FINISH', 0, 9 + 5.6, Z7(70.1), { w: 6, h: 1, border: '#3ddc97' });
    const fakeBeacon = beacon(w, 0, 9, Z7(70.1), 0x7dffb0, 16);
    counter(5, Z7(68), 2.4, 1.6, { y0: 9 });
    K.item('bill', 'bill', 'billtray', { name: 'The bill' });
    K.items.get('bill').init = { h: 'sgone' };
    K.station('billtray', { x: 5, y: 10, z: Z7(68), label: 'The bill', approach: [5, Z7(66.4)], accept: ['bill'], color: 0xf5f0e0 });
    const fakeZ = c.zone({ x: 0, y: 9 + 2, z: Z7(70.1), w: 7.4, h: 4, d: 3, need: 'both', shrink: 0 });
    let faked = false;
    const doFake = () => {
      if (faked) return; faked = true;
      fakeRing.visible = false; fakeBeacon.visible = false; fakeSign.visible = false;
      K.move('bill', 'sbilltray', { sp: 1 });
      w.burst(new THREE.Vector3(0, 11.5, Z7(70.1)), 0x3ddc97, 30, 5);
      tell('all', 'coop.l7.fake');
    };
    c.onEvent('fake:go', doFake);
    fakeZ.onChange((zn) => { if (zn.active && K.at('dtable') && !faked) c.emit('fake:go'); });
    w.updaters.push(() => { if (!faked && K.at('dtable') && !served2) { served2 = true; tell('all', 'coop.l7.arch'); } });
    let served2 = false;
    // the back stairs
    const BS = [];
    for (let k = 0; k < 5; k++) BS.push(deck(w, { x: [0, 2.4, -2.4, 2.4, 0][k], y: 9 - 1.8 * (k + 1), z: Z7(74.1 + 5.0 * k), w: 4, d: 3.4, ...FLOOR, path: true }));
    w.checkpoint({ x: BS[1].body.x, y: BS[1].top, z: BS[1].body.z, real: true });
    sgn('BACK STAIRS · STAFF AND FUGITIVES', 0, 9 + 3.4, Z7(72.6), { w: 7, h: 0.9, border: '#ffb43d' });
    for (let k = 0; k < 5; k++) lit(BS[k].body.x + 2.6, BS[k].top, BS[k].body.z + 1.2);
    const lobbyD0 = 97.4;
    planks(0, 0, Z7(lobbyD0 + 6.8), 16, 13.6, { path: true });                            // d 97.4 .. 111
    w.checkpoint({ x: 0, y: 0, z: Z7(lobbyD0 + 2), real: true });
    for (const lx of [-6.5, 6.5]) lit(lx, 0, Z7(lobbyD0 + 1));
    counter(0, Z7(101), 4, 1.6);
    K.station('cash', { x: 0, y: 1, z: Z7(101), label: 'The cashier', approach: [0, Z7(99.4)], accept: ['bill'], takeable: () => false, color: 0x39d7c9 });
    counter(-6, Z7(100), 2.4, 1.6);
    K.station('billprinter', { x: -6, y: 1, z: Z7(100), label: 'Receipt printer', approach: [-6, Z7(98.4)], accept: ['bill'], color: 0xf5f0e0 });
    sgn('RECEIPT PRINTER · REPRINTS IF YOU DROP IT', -6, 3.6, Z7(100), { w: 5.4, h: 0.8, border: '#f5f0e0' });
    w.updaters.push(() => { const it = K.items.get('bill'), h = K.holder('bill'), y = h === me ? game.player.y : h === c.other ? P.sy : null; if (h === 'scash' || h === 'sbillprinter' || (y !== null && y < 4)) billLow = true; it.home = billLow ? 'billprinter' : 'billtray'; });
    let billLow = false;
    sgn('CASHIER · THE BILL GOES HERE', 0, 3.6, Z7(101), { w: 6, h: 0.9 });
    sgn('SPLIT THE BILL', 0, 4.6, Z7(106), { w: 6, h: 1, border: '#ffc83d' });
    const payA = plate(w, { x: -5, y: 0, z: Z7(107), size: 2.4, need: 'p1', label: `${N.p1} PAYS HALF` });
    const payB = plate(w, { x: 5, y: 0, z: Z7(107), size: 2.4, need: 'p2', label: `${N.p2} PAYS HALF` });
    G.g8 = gate(w, { x: 0, z: Z7(111.4), w: 16, h: 5 });
    const exitT = { t: 0 };
    w.updaters.push((dt) => {
      exitT.t = K.at('cash') && payA.pressed && payB.pressed ? 9 : Math.max(0, exitT.t - dt);
      G.g8.set(exitT.t > 0);
    });
    sgn('THE EXIT · SERENITY FALLS THANKS YOU FOR YOUR BUSINESS', 0, 6.8, Z7(110.8), { w: 11, h: 1.2, border: '#3ddc97' });
    planks(0, 0, Z7(118.8), 14, 14, { path: true });
    const goalZ = Z7(121);
    w.goal({ x: 0, y: 0, z: goalZ });
    sgn('BOTH OF YOU. IN THE CIRCLE. THAT IS THE BILL PAID.', 0, 5.2, Z7(125), { w: 10, h: 1.4 });
    beacon(w, 0, 0, goalZ, 0xffe9a8, 20);
    for (const lx of [-5, 5]) lit(lx, 0, Z7(114.5));
    stage(w, 'back', { x: 0, y: 10, z: Z7(72), w: 8, h: 4, d: 3 }, () => tell('all', 'coop.l7.back'));
    stage(w, 'lobby', { x: 0, y: 1, z: Z7(lobbyD0 + 3), w: 16, h: 4, d: 4 }, () => tell('all', 'coop.l7.cashier'));
    let paySaid = false;
    w.updaters.push(() => { if (!paySaid && K.at('cash')) { paySaid = true; tell('p1', 'coop.l7.split.p1'); tell('p2', 'coop.l7.split.p2'); } });
    stage(w, 'exit', { x: 0, y: 1, z: Z7(113), w: 16, h: 4, d: 3 }, () => tell('all', 'coop.l7.exit'));
    mark('s8');
    bots.p1.push(
      { x: 2.5, z: Z7(70.1), r: 0.8, until: () => faked },
      S.take('billtray', 'bill'),
      { follow: true, until: () => game.player.z < Z7(lobbyD0 + 1) && game.player.y < 1 },
      S.put('cash'),
      { x: -5, z: Z7(107), r: 0.5, until: () => exitT.t > 3 },
      { follow: true },
    );
    bots.p2.push(
      { x: -2.5, z: Z7(70.1), r: 0.8, until: () => faked },
      { follow: true, until: () => game.player.z < Z7(lobbyD0 + 1) && game.player.y < 1 },
      { x: 5, z: Z7(107), r: 0.5, until: () => !!K.at('cash') && exitT.t > 3 },
      { follow: true },
    );

    if (window.__trace) { let acc = 0; w.updaters.push((dt) => { acc += dt; if (acc > 0.25) { acc = 0; const q = game.player; window.__bot?.log.push(`T ${w.t.toFixed(1)} ${me} ${q.x.toFixed(1)},${q.y.toFixed(1)},${q.z.toFixed(1)} ${q.grounded ? 'g' : 'a'} i=${w.botIndex?.()} ${w.botLast}`); } }); }
    dinnerBots(w, K, bots);
  },
};
