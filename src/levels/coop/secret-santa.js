import * as THREE from 'three';
import { chain } from '../common.js';
import { glowMaterial, plainMaterial } from '../../engine/materials.js';
import { retreatEnv, plate, gate, riser, sign, lantern, lake, stage, botSteps, beacon, COL } from './kit.js';
import { snowdeck, liveSign, pedestal, present, drift, retractBridge, stomper, snowballs, snowman } from './secret-santa-kit.js';

// Session 8 — Secret Santa. A snowy lodge gift exchange about temptation.
// Sabotage exists (a shiny gift, a coal gift, a secret prank button) but it always has a tell and a price, and a friendly-mode
// switch (both flip it) turns every sabotage button off for the whole level. The cooperative path is always open.
//   1 lodge: friendly-mode switch + the mole is briefed      2 gift exchange + split lanes     3 prank ravine (hidden buttons)
//   4 snowball range (knock-back only)                        5 hot-chocolate lifts (trust)     6 Santa's workshop (presses, belts, ferries)
//   7 the fake grand prize + the lying counsellor             8 two plates, the stairs, the real goal + the receipts board
// First-time pairs: about 10 minutes.

const KINDS = ['safe', 'shiny', 'coal'];
const PRESENT_COL = [0xd84a4a, 0x3aa05c, 0x4a78d8];

export default {
  id: 'coop8',
  name: 'Secret Santa',
  music: 'l1',
  deathRule: 'self',
  completeQuip: 'Exchanged: gifts, glances and at least one grudge. The counsellor logged all of it.',
  titleCam: { center: [0, 2, -60], radius: 30, height: 12 },

  build(w, game) {
    retreatEnv(w, { mood: 'night' });
    lake(w, -30, 600, 0xcfe0f2);
    const c = w.coop, me = c.me, other = c.other, N = c.names;
    w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    const tell = (r, k, o) => c.tell(r, k, o);
    const nm = (r) => N[r];
    const cp = (x, y, z) => w.checkpoint({ x, y, z, real: true });
    const friendly = () => !!c.get('friendly', false);
    const roles = ['p1', 'p2'];
    const opp = (r) => (r === 'p1' ? 'p2' : 'p1');
    const mole = c.rng(7)() < 0.5 ? 'p1' : 'p2';
    const pranker = c.rng(3)() < 0.5 ? 'p1' : 'p2';
    const holder1 = c.rng(5)() < 0.5 ? 'p1' : 'p2';
    const P = c.partner;

    // ============================================================ 1. the lodge: friendly mode, the mole =======
    snowdeck(w, { x: 0, y: 0, z: -14, w: 24, d: 40, path: true });                      // z +6 … -34
    sign(w, 'SERENITY FALLS · WINTER LODGE', 0, 5.2, 4, { w: 12, h: 1.6 });
    sign(w, 'SESSION 8: SECRET SANTA', 0, 3.6, 4, { w: 8, h: 1, border: '#ff4d5e' });
    for (const lx of [-9, 9]) { lantern(w, lx, 0, 2); lantern(w, lx, 0, -22); }
    const frSign = liveSign(w, 0, 4.4, -12, { w: 9, h: 2.4, tw: 768, border: '#3ddc97' });
    const frText = () => {
      const f1 = c.get('fr.p1', false), f2 = c.get('fr.p2', false), on = (v) => (v ? 'ON' : 'off');
      if (friendly()) return 'FRIENDLY MODE: ON\nNo sabotage buttons this level.\nThe counsellor is disappointed.';
      return `FRIENDLY MODE\n${nm('p1')}: ${on(f1)}   ${nm('p2')}: ${on(f2)}\nBoth ON = every sabotage button is locked for the whole level.`;
    };
    const refreshFr = () => frSign.set(frText());
    const latch = () => { if (c.get('fr.p1', false) && c.get('fr.p2', false) && !friendly()) c.set('friendly', true); };
    for (const r of roles) c.on('fr.' + r, () => { latch(); refreshFr(); });
    c.on('friendly', (v) => { refreshFr(); if (v) tell('all', 'coop.l8.friendly.on'); });
    refreshFr();
    pedestal(w, {
      x: 0, y: 0, z: -9, color: 0x3ddc97,
      label: () => `Friendly mode: ${c.get('fr.' + me, false) ? 'ON (press to turn off)' : 'off (press to turn on)'}`,
      enabled: () => !friendly(),
      onUse: () => { c.set('fr.' + me, !c.get('fr.' + me, false)); game.audio.confirm?.(); },
    });
    stage(w, 'welcome', { x: 0, y: 1, z: 2, w: 30, h: 4, d: 8 }, () => {
      tell('p1', 'coop.l8.intro.p1', { priority: 2 }); tell('p2', 'coop.l8.intro.p2', { priority: 2 });
      w.after(9, () => tell(mole, 'coop.l8.mole', { priority: 2 }));
    });
    stage(w, 'friendly', { x: 0, y: 1, z: -8, w: 24, h: 4, d: 5 }, () => tell('all', 'coop.l8.friendly'));
    cp(0, 0, -30);

    // ============================================================ 2. the gift exchange ===================
    snowdeck(w, { x: 0, y: 0, z: -54, w: 32, d: 40, path: true });                      // z -34 … -74
    sign(w, 'OPEN ONE PRESENT. IT IS FOR YOUR PARTNER.', 0, 5.4, -36, { w: 13, h: 1.4 });
    sign(w, 'ONLY YOU CAN READ THE TAGS ON YOUR OWN PRESENTS.', 0, 3.9, -36, { w: 13, h: 1, border: '#ff4d5e', size: 36 });
    const giftKind = { p1: null, p2: null };
    const perm = (r) => { const rr = c.rng(r === 'p1' ? 101 : 102), a = [0, 1, 2]; for (let i = 2; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.map((i) => KINDS[i]); };
    const contents = { p1: perm('p1'), p2: perm('p2') };
    const presents = { p1: [], p2: [] };
    const tableX = (r) => (r === 'p1' ? -8 : 8);
    const presentX = (r, i) => tableX(r) + (i - 1) * 2.8;
    const rug = (x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(9, 0.05, 4.4), plainMaterial(0x7a2630, { roughness: 1 })); m.position.set(x, 0.03, -46); w.add(m); };
    rug(-8); rug(8);
    sign(w, nm('p1') + "'S PRESENTS", -8, 3.0, -49.5, { w: 6, h: 0.9, border: '#ff9a3d' });
    sign(w, nm('p2') + "'S PRESENTS", 8, 3.0, -49.5, { w: 6, h: 0.9, border: '#39d7c9' });
    const kindLabel = (k, who) => {
      const them = nm(opp(who));
      if (k === 'safe') return `SAFE: a stepping stone appears for ${them}`;
      if (k === 'shiny') return friendly() ? 'SHINY (locked: friendly mode)' : `SHINY: +1000 glitter for you · ${them} gets a snowdrift`;
      return friendly() ? 'COAL (locked: friendly mode)' : `COAL: stompers ahead in ${them}'s lane (they can see the red)`;
    };
    for (const r of roles) for (let i = 0; i < 3; i++) {
      const px = presentX(r, i);
      presents[r][i] = present(w, px, 0, -46, PRESENT_COL[i]);
      w.interactable({
        x: px, y: 1.0, z: -46, w: 1.6, h: 2.0, d: 1.6,
        label: () => (r === me ? `Open for ${nm(other)}: ${kindLabel(contents[r][i], r)}` : `${nm(r)}'s present (not yours to open)`),
        enabled: () => !c.get('gift.' + r, null) && !(r !== me),
        onUse: () => {
          const k = contents[r][i];
          if (friendly() && k !== 'safe') { game.ui.toast('Friendly mode is on: only the safe gift can be opened', ''); return; }
          if (c.get('gift.' + r, null)) return;
          c.set('gift.' + r, { k, i }); game.audio.confirm?.();
        },
      });
    }
    // an interactable that only the table's owner can use; for the other player the label shows who it belongs to
    const board = liveSign(w, 0, 4.6, -63, { w: 15, h: 3.2, tw: 1024, border: '#ffc83d', size: 34 });
    const score = { p1: 0, p2: 0 };
    const desc = (giver) => {
      const k = giftKind[giver], rec = nm(opp(giver));
      if (!k) return `${nm(giver)} has not opened a present yet`;
      if (k === 'safe') return `${nm(giver)} gave ${rec} a SAFE GIFT: stepping stones in ${rec}'s lane`;
      if (k === 'shiny') return `${nm(giver)} gave ${rec} a SHINY GIFT: +1000 glitter for ${nm(giver)}, a snowdrift for ${rec}`;
      return `${nm(giver)} gave ${rec} COAL: red-marked stompers in ${rec}'s lane`;
    };
    const refreshBoard = () => board.set(!giftKind.p1 || !giftKind.p2 ? `GIFT EXCHANGE\n${desc('p1')}\n${desc('p2')}` : `WHAT WAS GIVEN\n${desc('p1')}\n${desc('p2')}`);
    refreshBoard();
    // lanes: one for each player. What is in YOUR lane depends on what your PARTNER opened for you.
    const lane = {};
    const laneX = (r) => (r === 'p1' ? -7.5 : 7.5);
    for (const r of roles) {
      const xc = laneX(r), L = (lane[r] = {});
      snowdeck(w, { x: xc, y: 0, z: -79, w: 9, d: 10, path: r });                                    // -74 … -84
      L.stone1 = snowdeck(w, { x: xc, y: 0, z: -85.7, w: 2.4, d: 1.8, path: r });
      snowdeck(w, { x: xc, y: 0, z: -93.4, w: 9, d: 12, path: r });                                  // -87.4 … -99.4
      L.stone2 = snowdeck(w, { x: xc, y: 0, z: -101.1, w: 2.4, d: 1.8, path: r });
      snowdeck(w, { x: xc, y: 0, z: -106.8, w: 9, d: 8, path: r });                                  // -102.8 … -110.8
      L.stone1.setEnabled(false); L.stone2.setEnabled(false);
      L.drift = [drift(w, xc, 0, -79, 9, 10, r === 'p1' ? 1 : 2), drift(w, xc, 0, -90.4, 9, 6, r === 'p1' ? 3 : 4)];
      L.coal = false; L.shiny = false;
      sign(w, r === me ? 'YOUR LANE' : nm(r) + "'S LANE", xc, 3.4, -75, { w: 6, h: 0.9, border: '#' + COL[r].toString(16).padStart(6, '0') });
      [[-90.5, 0], [-95.5, 0.7]].forEach(([zz, o]) => [-3, 0, 3].forEach((dx, ci) => stomper(w, { x: xc + dx, y: 0, z: zz, size: 3, period: 4.2, offset: o + ci * 1.4, paused: () => !L.coal })));
    }
    const applyGift = (giver, v) => {
      const k = v.k; giftKind[giver] = k;
      presents[giver][v.i].visible = false;
      const rec = opp(giver), L = lane[rec];
      if (k === 'safe') { L.stone1.setEnabled(true); L.stone2.setEnabled(true); }
      if (k === 'shiny') { L.shiny = true; L.drift.forEach((d) => { d.visible = true; }); score[giver] += 1000; }
      if (k === 'coal') L.coal = true;
      refreshBoard();
      tell(rec, 'coop.l8.got.' + k); tell(giver, 'coop.l8.gave.' + k);
      if (giftKind.p1 && giftKind.p2) tell('all', 'coop.l8.gifts.done');
    };
    for (const r of roles) c.on('gift.' + r, (v) => { if (v && !giftKind[r]) applyGift(r, v); });
    const g2 = gate(w, { x: 0, z: -69, w: 32, h: 5 });
    sign(w, 'EXCHANGE FIRST. THEN THE DOOR OPENS.', 0, 6.4, -68.4, { w: 11, h: 1.2 });
    w.updaters.push(() => g2.set(!!giftKind.p1 && !!giftKind.p2));
    // the snowdrift only slows the one it was given to (their own machine)
    w.updaters.push((dt) => {
      const L = lane[me], p = game.player;
      if (!L.shiny || !p.grounded) return;
      if (Math.abs(p.x - laneX(me)) < 4.6 && p.z < -74 && p.z > -93.4) { const k = Math.max(0, 1 - 32 * dt); p.vx *= k; p.vz *= k; }
    });
    stage(w, 'hall', { x: 0, y: 1, z: -40, w: 32, h: 4, d: 6 }, () => tell('all', 'coop.l8.hall'));
    stage(w, 'lanes', { x: 0, y: 1, z: -76, w: 32, h: 4, d: 4 }, () => tell('all', 'coop.l8.lanes'));
    cp(0, 0, -72);
    // merge
    snowdeck(w, { x: 0, y: 0, z: -118.4, w: 32, d: 15.2, path: true });                 // -110.8 … -126
    cp(0, 0, -114);
    stage(w, 'merge', { x: 0, y: 1, z: -112, w: 32, h: 4, d: 3 }, () => tell('all', 'coop.l8.merge'));

    // ============================================================ 3. the prank ravine =======================
    const Zb = [-130.5, -147.5, -164.5];                                               // bridge centres (9 long)
    const bridges = [];                                                                // created in route order (bots follow creation order)
    const ravineDecks = [[-139, 8], [-156, 8], [-175, 12]];                            // -135…-143, -152…-160, -169…-181
    Zb.forEach((z, k) => {
      bridges.push(retractBridge(w, { x: 0, y: 0, z, id: k + 1 }));
      snowdeck(w, { x: 0, y: 0, z: ravineDecks[k][0], w: 16, d: ravineDecks[k][1], path: true });
    });
    const hops = Zb.map((zb, k) => [2.6, 0, -2.6].map((dz) => { const t = riser(w, { x: 5.8, y: 0, z: zb + dz, w: 1.6, d: 1.5, h: 0.5, drop: 4, speed: 6, color: 0xbfd6ee }); t.plat.body.slip = 0.9; return t; }));
    w.updaters.push(() => hops.forEach((row, k) => { const e = w.t - bridges[k].t0; row.forEach((t) => { t.set(e >= 0 && e < 7); t.plat.group.visible = t.k > 0.04; }); }));
    sign(w, 'THE BRIDGES ARE FINE. PROBABLY.', 0, 5.0, -127, { w: 8, h: 1.1 });
    const prankPos = [[-12, -121], [-6.5, -138], [-6.5, -155]];
    prankPos.forEach(([px, pz], k) => {
      if (pranker !== me) return;
      pedestal(w, {
        x: px, y: 0, z: pz, color: 0xff4d5e,
        label: () => (friendly() ? 'Prank button (locked: friendly mode)' : `PRANK: bridge ${k + 1} flickers away for ${nm(other)}. Your own shortcut rises beside it.`),
        enabled: () => !friendly() && !c.get('pk.used.' + (k + 1), false) && bridges[k].phase === 'up',
        onUse: () => {
          c.set('pk.used.' + (k + 1), true); c.set('pk.' + (k + 1), +w.t.toFixed(2));
          c.set('pk.n.' + me, (c.get('pk.n.' + me, 0) || 0) + 1);
          tell(me, 'coop.l8.prank.did');
        },
      });
    });
    bridges.forEach((b, k) => c.on('pk.' + (k + 1), () => { if (pranker !== me) tell(me, 'coop.l8.prank.seen'); }));
    stage(w, 'ravine', { x: 0, y: 1, z: -128, w: 16, h: 4, d: 3 }, () => { tell(pranker, 'coop.l8.ravine.prankster'); tell(opp(pranker), 'coop.l8.ravine.honest'); });
    cp(0, 0, -156);
    stage(w, 'ravine2', { x: 0, y: 1, z: -156, w: 16, h: 4, d: 4 }, () => tell('all', 'coop.l8.ravine.mid'));

    // ============================================================ 4. the snowball range ====================
    snowdeck(w, { x: 0, y: 0, z: -199, w: 32, d: 36, path: true });                    // -181 … -217
    const wallY = 3.0;
    const wall = (x, z, ww, dd) => w.plat({ x, y: wallY, z, w: ww, d: dd, h: 3, tex: 'wood', color: 0xb9c7da });
    wall(-16.4, -199, 0.8, 36); wall(16.4, -199, 0.8, 36);
    wall(-10.9, -181.4, 11.8, 0.8); wall(10.9, -181.4, 11.8, 0.8);                      // front, with a 10 m opening
    wall(-10.9, -216.6, 11.8, 0.8); wall(10.9, -216.6, 11.8, 0.8);
    const g4 = gate(w, { x: 0, z: -216.6, w: 10, h: 5 });
    for (const [cx, cz] of [[-9, -200], [9, -200]]) w.plat({ x: cx, y: 1.2, z: cz, w: 2.4, d: 2.4, h: 1.2, tex: 'wood', color: 0xa9b8cf });
    const TX = [-10, -3.5, 3.5, 10];
    const targets = TX.map((cx, i) => snowman(w, (t) => ({ x: cx + 2.2 * Math.sin((t / 9) * Math.PI * 2 + i * 1.7), y: 0, z: -211 })));
    let hits = 0;
    const tgtSign = liveSign(w, 0, 6.6, -181.4, { w: 10, h: 1.9, tw: 800, border: '#ff4d5e', size: 40 });
    const refreshTg = () => tgtSign.set(hits >= 4 ? 'ALL SNOWMEN DOWN\nThe door is open.' : `SNOWMEN: ${hits} / 4\nAIM, THEN PRESS F (or click)\nHitting your partner only pushes them. They will notice.`);
    refreshTg();
    c.onEvent('tgt', (i) => { if (targets[i].hit) return; targets[i].hit = true; hits++; refreshTg(); game.audio.confirm?.(); if (hits === 2) tell('all', 'coop.l8.snow.half'); });
    const inArena = () => game.player.z < -181 && game.player.z > -217 && Math.abs(game.player.x) < 17;
    const SB = snowballs(w, { targets, onTarget: (i) => c.emit('tgt', i), active: inArena });
    w.updaters.push(() => g4.set(hits >= 4));
    stage(w, 'arena', { x: 0, y: 1, z: -186, w: 12, h: 4, d: 4 }, () => tell('all', 'coop.l8.snow'));
    cp(0, 0, -184);

    // ============================================================ 5. hot chocolate: someone holds, someone climbs ==
    const H = 4.5;
    const cocoa = {}, thanks = {};
    const tower = (r, y0, zc, holder, udD) => {
      const rider = opp(holder), top = y0 + H;
      if (r === 1) snowdeck(w, { x: 0, y: y0, z: zc, w: 16, d: 12, path: true });                              // ground
      const ud = snowdeck(w, { x: 0, y: top, z: zc - 9.4 - udD / 2, w: 16, d: udD, h: H, path: true });
      void ud;
      const l1 = riser(w, { x: 4, y: top, z: zc - 7.7, w: 3.4, d: 3.4, h: 0.6, drop: H, always: true, speed: 4.2, color: 0xe9d9b0, trim: COL[holder] });
      const l2 = riser(w, { x: -4, y: top, z: zc - 7.7, w: 3.4, d: 3.4, h: 0.6, drop: H, always: true, speed: 4.2, color: 0xe9d9b0, trim: COL[rider] });
      const p1z = plate(w, { x: -2, y: y0, z: zc - 2.5, need: holder, label: `${nm(holder)}: HOLD (lifts ${nm(rider)})` });
      const p2z = plate(w, { x: 0, y: top, z: zc - 11.9, need: rider, label: `${nm(rider)}: HOLD (lifts ${nm(holder)})` });
      cocoa[r] = false; thanks[r] = false;
      pedestal(w, {
        x: 6.5, y: top, z: zc - 13.5, color: 0x8a5a3a,
        label: `Pour the hot chocolate for ${nm(holder)}`,
        enabled: () => me === rider && !cocoa[r],
        onUse: () => { c.emit('cocoa' + r); },
      });
      const mugSign = liveSign(w, 6.5, top + 2.6, zc - 13.5, { w: 4.4, h: 1.0, tw: 512, border: '#8a5a3a', size: 30 });
      pedestal(w, {
        x: -6.5, y: top, z: zc - 13.5, color: 0xff9ad5,
        label: 'Say thank you (♥)',
        enabled: () => me === holder && cocoa[r] && !thanks[r] && game.player.y > top - 1,
        onUse: () => { c.emit('thanks' + r); },
      });
      const gt = gate(w, { x: 0, y: top, z: zc - 15.9, w: 16, h: 5 });
      const setMug = () => mugSign.set(thanks[r] ? 'THANK YOU RECEIVED ♥' : cocoa[r] ? `${nm(holder)}: ride the other lift,\nthen say thank you` : `${nm(rider)}: hot chocolate for ${nm(holder)}`);
      setMug();
      c.onEvent('cocoa' + r, () => { if (cocoa[r]) return; cocoa[r] = true; setMug(); tell('all', 'coop.l8.cocoa'); });
      c.onEvent('thanks' + r, () => { if (thanks[r]) return; thanks[r] = true; setMug(); game.ui.toast(`${nm(holder)}: thank you ♥`, 'good'); tell('all', 'coop.l8.thanks'); });
      w.updaters.push(() => { l1.set(p1z.pressed); l2.set(p2z.pressed && cocoa[r]); gt.set(thanks[r]); });
      sign(w, 'THE LIFT ONLY WORKS WHILE SOMEONE STANDS ON THEIR PLATE.', 0, y0 + 6.4, zc - 3, { w: 11, h: 1.4, size: 34 });
      // bots
      const steps = me === holder
        ? [{ x: -2, z: zc - 2.5, until: () => cocoa[r] }, { x: -4, z: zc - 7.7, until: () => game.player.y > top - 0.6 }, { x: -6.5, z: zc - 13.5, use: true, until: () => thanks[r] }]
        : [{ x: 4, z: zc - 7.7, until: () => game.player.y > top - 0.6 }, { x: 6.5, z: zc - 13.5, use: true, until: () => cocoa[r] },
           { x: 0, z: zc - 11.9, until: () => P.has && P.sy > top - 0.6 }, { x: 0, z: zc - 14.3, until: () => thanks[r] }];
      return steps;
    };
    const zc1 = -223, zc2 = -246;
    const t1 = tower(1, 0, zc1, holder1, 19.6);
    const t2 = tower(2, H, zc2, opp(holder1), 14);
    cp(0, 0, -220);
    cp(0, H, -243);
    stage(w, 'cocoa', { x: 0, y: 1, z: -222, w: 16, h: 4, d: 6 }, () => tell('all', 'coop.l8.cocoa.intro'));
    stage(w, 'cocoa2', { x: 0, y: H + 1, z: -243, w: 16, h: 4, d: 5 }, () => tell('all', 'coop.l8.cocoa.swap'));

    // ============================================================ 6. Santa's workshop =========================
    const Yw = 2 * H;
    cp(0, Yw, -265);
    const pa = plate(w, { x: -6.5, y: Yw, z: -266.5, need: 'any', label: 'HOLD: STOPS THE PRESSES' });
    const belt = snowdeck(w, { x: 0, y: Yw, z: -276.4, w: 10, d: 14, path: true });
    w.conveyor(belt, { vz: 3.2 });
    const pb = plate(w, { x: 6.5, y: Yw, z: -287, need: 'any', label: 'HOLD: STOPS THE PRESSES' });
    const stopped = () => pa.pressed || pb.pressed;
    [[-273.5, 0, 'A'], [-279.5, 1.05, 'B']].forEach(([zz, o]) => [-2.5, 2.5].forEach((dx, ci) => stomper(w, { x: dx, y: Yw, z: zz, size: 4.6, period: 4.2, offset: o + ci * 2.1, paused: stopped, coal: false })));
    sign(w, 'THE PRESSES RUN WHEN NOBODY HOLDS A PLATE.', 0, Yw + 5.2, -268, { w: 11, h: 1.3 });
    snowdeck(w, { x: 0, y: Yw, z: -288.4, w: 10, d: 10, path: true });                 // -283.4 … -293.4
    cp(0, Yw, -289);
    const ferry = (z, ph) => { const f = w.plat({ x: 0, y: Yw, z, w: 5.4, d: 5, h: 0.7, moving: true, path: true, tex: 'wood', color: 0xd9c9a0 }); w.mover(f, (t) => ({ z: -Math.sin((t / 9) * Math.PI * 2 + ph) * 3 })); return f; };
    ferry(-298.9, 0);
    snowdeck(w, { x: 0, y: Yw, z: -309.4, w: 10, d: 10, path: true });                 // -304.4 … -314.4
    cp(0, Yw, -309);
    ferry(-319.9, Math.PI);
    snowdeck(w, { x: 0, y: Yw, z: -331.4, w: 10, d: 12, path: true });                 // -325.4 … -337.4
    sign(w, "SANTA'S WORKSHOP · NORTH POLE LOGISTICS", 0, Yw + 5.4, -283.6, { w: 10, h: 1.2, border: '#ff4d5e' });
    stage(w, 'workshop', { x: 0, y: Yw + 1, z: -262, w: 16, h: 4, d: 5 }, () => tell('all', 'coop.l8.work'));
    stage(w, 'work2', { x: 0, y: Yw + 1, z: -288, w: 10, h: 4, d: 4 }, () => tell('all', 'coop.l8.work.done'));
    stage(w, 'ferry', { x: 0, y: Yw + 1, z: -294, w: 10, h: 4, d: 3 }, () => tell('all', 'coop.l8.ferry'));

    // ============================================================ 7. the fake grand prize ===================
    snowdeck(w, { x: 0, y: Yw, z: -349.4, w: 20, d: 24, path: true });                 // -337.4 … -361.4
    cp(0, Yw, -342);
    const fz = -352;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.14, 12, 48), glowMaterial(0xffc83d, 2.2)); ring.position.set(0, Yw + 1.9, fz); w.add(ring);
    sign(w, 'GRAND PRIZE', 0, Yw + 4.6, fz, { w: 5, h: 1.1, border: '#ffc83d' });
    [[0, 0.3], [-1.4, 0.4], [1.3, 0.2]].forEach(([dx, dz], i) => present(w, dx, Yw, fz - 2.2 - dz, [0xffc83d, 0xd84a4a, 0x4a78d8][i], 1.2));
    beacon(w, 0, Yw, fz, 0xffe9a8, 16);
    const g7 = gate(w, { x: 0, y: Yw, z: -359.5, w: 20, h: 5 });
    let fake = false;
    const fakeZ = c.zone({ x: 0, y: Yw + 1.9, z: fz, w: 3.6, h: 3.6, d: 3.6, need: 'both', shrink: 0 });
    // what the counsellor claims to each player about the OTHER, and what is actually true
    const claims = (V) => {
      const S = opp(V), idx = V === 'p1' ? 1 : 2;
      const tg = giftKind[S] || 'safe', rg = c.rng(40 + idx), lieG = rg() < 0.5;
      const cg = lieG ? KINDS.filter((k) => k !== tg)[Math.floor(rg() * 2)] : tg;
      const tp = c.get('pk.n.' + S, 0) || 0, rp = c.rng(50 + idx), lieP = rp() < 0.55;
      const cpn = lieP ? tp + 1 + Math.floor(rp() * 2) : tp;
      return { tg, cg, lieG, tp, cpn, lieP: cpn !== tp };
    };
    fakeZ.onChange((zn) => {
      if (!zn.active || fake) return;
      fake = true; ring.visible = false; g7.set(true);
      tell('all', 'coop.l8.fake');
      for (const V of roles) {
        const cl = claims(V);
        w.after(6, () => tell(V, 'coop.l8.claim.gift.' + cl.cg));
        w.after(13, () => tell(V, 'coop.l8.claim.prank.' + Math.min(2, cl.cpn)));
      }
      w.after(20, () => tell('all', 'coop.l8.claim.after'));
    });
    stage(w, 'prize', { x: 0, y: Yw + 1, z: -341, w: 20, h: 4, d: 4 }, () => tell('all', 'coop.l8.prize'));

    // ============================================================ 8. the real goal ============================
    snowdeck(w, { x: 0, y: Yw, z: -369.4, w: 20, d: 16, path: true });                 // -361.4 … -377.4
    const g8 = gate(w, { x: 0, y: Yw, z: -373, w: 20, h: 5 });
    const fa = plate(w, { x: -5, y: Yw, z: -367, need: 'p1', label: nm('p1') });
    const fb = plate(w, { x: 5, y: Yw, z: -367, need: 'p2', label: nm('p2') });
    const door = { t: 0 };
    w.updaters.push((dt) => { door.t = fa.pressed && fb.pressed ? 8 : Math.max(0, door.t - dt); g8.set(door.t > 0); });
    sign(w, 'ONE EACH. THE REAL PRIZE IS UPSTAIRS.', 0, Yw + 6.4, -372, { w: 11, h: 1.2 });
    cp(0, Yw, -376);
    const st = chain(w, { x: 0, y: Yw, z: -377.4 }, Array.from({ length: 8 }, (_, i) => ({ gap: i === 0 ? 1.8 : 1.7, d: 4, w: 6 - (i % 3), dy: 1.2 })));
    w.crumble(st[3], { delay: 1.0, gone: 3 }); w.crumble(st[6], { delay: 1.0, gone: 3 });
    cp(0, st[2].top, st[2].body.z);
    const gy = st.endY + 1.0, gz = st.endZ - 1.8 - 8;
    snowdeck(w, { x: 0, y: gy, z: gz, w: 16, d: 16, path: true });
    cp(0, gy, gz + 5);
    w.goal({ x: 0, y: gy, z: gz - 3 });
    beacon(w, 0, gy, gz - 3, 0xffe9a8, 22);
    for (const lx of [-6, 6]) lantern(w, lx, gy, gz + 3);
    const recap = liveSign(w, 0, gy + 5.6, gz - 7.5, { w: 15, h: 4.4, tw: 1100, border: '#ffc83d', size: 30 });
    const quote = (V, cl) => `${nm(V)} was told: gift "${cl.cg.toUpperCase()}" (${cl.lieG ? 'LIE' : 'true'}) · pranked ${cl.cpn}x (${cl.lieP ? `LIE: really ${cl.tp}` : 'true'})`;
    const molePartner = opp(mole);
    const fallsOf = () => c.get('falls.' + molePartner, null);
    const goldenOk = () => fallsOf() === 2;
    const refreshRecap = () => {
      const a = claims('p1'), b = claims('p2'), f = fallsOf();
      recap.set(['THE RECEIPTS',
        `GIFTS: ${nm('p1')} gave ${(giftKind.p1 || '?').toUpperCase()} · ${nm('p2')} gave ${(giftKind.p2 || '?').toUpperCase()}   GLITTER: ${score.p1} / ${score.p2}`,
        `PRANKS: ${nm('p1')} ${c.get('pk.n.p1', 0) || 0} · ${nm('p2')} ${c.get('pk.n.p2', 0) || 0}${friendly() ? '   (friendly mode was ON)' : ''}`,
        quote('p1', a), quote('p2', b),
        `THE MOLE WAS ${nm(mole).toUpperCase()}. ${nm(molePartner)} fell ${f ?? '?'} time(s). ${goldenOk() ? 'GOLDEN SNOWFLAKE.' : 'No snowflake.'}`].join('\n'));
    };
    refreshRecap();
    for (const k of ['pk.n.p1', 'pk.n.p2', 'falls.p1', 'falls.p2']) c.on(k, refreshRecap);
    stage(w, 'reveal', { x: 0, y: gy + 1, z: gz + 4, w: 16, h: 4, d: 5 }, () => {
      c.set('falls.' + me, game.deaths); refreshRecap(); tell('all', 'coop.l8.reveal');
    });
    stage(w, 'stairs', { x: 0, y: Yw + 1, z: -379, w: 10, h: 4, d: 3 }, () => tell('all', 'coop.l8.stairs'));

    // ---- mole bookkeeping and the results-screen payoff (cosmetic only) ----
    let molePartnerFalls = 0;
    w.hooks.onPartnerDeath = () => {
      if (me === mole) { molePartnerFalls++; tell(me, 'coop.l8.mole.fall'); }
      else if (Math.random() < 0.35) tell('all', 'coop.l8.partnerdown');
      return true;
    };
    w.hooks.onComplete = () => {
      setTimeout(() => {
        const q = game.ui.el['cmp-quip']; if (!q || game.state !== 'complete') return;
        const f = c.get('falls.' + molePartner, null);
        q.textContent += `  ·  ❄ The mole was ${nm(mole)}. ${f === 2 ? 'Golden snowflake awarded.' : 'No snowflake this time.'}  ·  Glitter: ${nm('p1')} ${score.p1}, ${nm('p2')} ${score.p2}`;
      }, 2400);
      return null;
    };
    void molePartnerFalls; void fallsOf;

    // ============================================================ scripted bots (never prank; always open the SAFE gift) ====
    const safeIdx = (r) => contents[r].indexOf('safe');
    const gift = (r) => [{ x: presentX(r, safeIdx(r)), z: -46, r: 1.3, use: true, until: () => !!c.get('gift.' + r, null) }, { x: 0, z: -66, until: () => g2.passable }];
    const shoot = (idx) => ({ x: me === 'p1' ? -5 : 5, z: -196, until: () => { for (const i of idx) if (!targets[i].hit) { SB.throwAt(targets[i].pos); break; } return g4.passable; } });
    const zP = () => game.player.z, yP = () => game.player.y;
    const holderOf2 = holder1;
    void holderOf2;
    const workshop = me === 'p1'
      ? [{ x: -6.5, z: -266.5, until: () => pb.pressed }, { follow: true, until: () => zP() < -300 }]          // p1 holds the presses while p2 crosses, then crosses
      : [{ x: 0, z: -266, until: () => pa.pressed }, { follow: true, until: () => zP() < -284 }, { x: 6.5, z: -287, until: () => P.has && P.sz < -284 }, { follow: true, until: () => zP() < -300 }];
    botSteps(w, {
      p1: [{ follow: true, until: () => zP() < -40 }, ...gift('p1'), { follow: true, until: () => zP() < -184 }, shoot([0, 1]),
        { follow: true, until: () => zP() < -219 }, ...t1, ...t2, { follow: true, until: () => zP() < -262 }, ...workshop,
        { follow: true, until: () => zP() < -340 }, { x: -1, z: fz, until: () => fake }, { follow: true, until: () => zP() < -363 },
        { x: -5, z: -367, until: () => g8.passable }, { follow: true }],
      p2: [{ follow: true, until: () => zP() < -40 }, ...gift('p2'), { follow: true, until: () => zP() < -184 }, shoot([2, 3]),
        { follow: true, until: () => zP() < -219 }, ...t1, ...t2, { follow: true, until: () => zP() < -262 }, ...workshop,
        { follow: true, until: () => zP() < -340 }, { x: 1, z: fz, until: () => fake }, { follow: true, until: () => zP() < -363 },
        { x: 5, z: -367, until: () => g8.passable }, { follow: true }],
    });
    void yP;
  },
};
