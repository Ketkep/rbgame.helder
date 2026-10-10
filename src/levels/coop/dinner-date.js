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

    // ---- the end of stage 1 (temporary: stage 2 follows below)
    let zc = lastD - 0.8;                                                                // the gate sits here
    void zc;

    // ============================================================ finish (placeholder) ============
    const fz = lastD - 6;
    planks(0, 0, fz - 4, 14, 14, { path: true });
    w.goal({ x: 0, y: 0, z: fz - 6 });

    dinnerBots(w, K, bots);
  },
};
