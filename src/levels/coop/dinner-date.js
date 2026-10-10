import * as THREE from 'three';
import { glowMaterial } from '../../engine/materials.js';
import { retreatEnv, deck, plate, gate, riser, sign, lantern, lake, stage, beacon, COL } from './kit.js';
import { carryKit, chef as makeChef, dinnerBots, stepsFor } from './dinner-date-kit.js';

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
    K.onBreak = (it, why) => { if (it.id === 'china') tell('all', 'coop.l7.chinabreak'); else if (why === 'spill') tell('all', 'coop.l7.spill'); else if (why === 'crush') tell('all', 'coop.l7.crush'); else tell('all', 'coop.l7.smash'); };

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
    const endZ = z3a - 22;

    // ============================================================ finish (placeholder) ============
    planks(0, 0, endZ - 7, 14, 14, { path: true });
    both({ x: 0, z: endZ - 4, r: 1.2 });
    w.goal({ x: 0, y: 0, z: endZ - 6 });

    dinnerBots(w, K, bots);
  },
};
