import * as THREE from 'three';
import { chain } from '../common.js';
import { retreatEnv, deck, gate, sign, roleSign, lantern, lake, stage, setDeathRule, beacon, COL } from './kit.js';
import { pedestal } from './newlywed-kit.js';
import { carryKit } from './dinner-date-kit.js';
import { witnesses, glassPillar, chandelier, mirrorGhost, mirrorLanes, chairPlates, galaBots } from './gala-kit.js';

// Session 15 — Anniversary Gala. The real finale, in a glass ballroom tower with witnesses (silent silhouettes that watch and applaud).
// 1 the mirror hall (two lanes of linked tiles, your partner shown as a reflection), 2 the toast (two glasses, half a second),
// 3 the quadrille (blinking tiles on a rope), 4 the speech (each of you hears the OTHER one's route), 5 the callbacks: hand the tray
// across the gaps, a rope over two ferries that take turns, musical-chairs plates; 6 the cake tower (both fall together, ring at the top).
// Dusk, then a storm gathers by the top tiers (lighting only). First-time pairs: ~10 minutes.

const OTHER = { p1: 'p2', p2: 'p1' };

export default {
  id: 'coop15',
  name: 'Anniversary Gala',
  music: 'l1',
  deathRule: 'self',
  completeQuip: 'Fifteen sessions. The cake is gone, the witnesses applauded, and I have your invoice ready. Happy anniversary. Same time next year?',
  titleCam: { center: [0, 2, -60], radius: 30, height: 12 },

  build(w, game) {
    retreatEnv(w, { mood: 'dusk' });
    lake(w, -30);
    const c = w.coop, me = c.me, N = c.names, P = c.partner;
    const tell = (r, k, o) => c.tell(r, k, o);
    const gp = () => game.player;
    w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    const B = { p1: [], p2: [] };
    const both = (...s) => { B.p1.push(...s.map((o) => ({ ...o }))); B.p2.push(...s.map((o) => ({ ...o }))); };
    const near = (x, z, r = 1.0) => Math.hypot(gp().x - x, gp().z - z) < r;
    const pnear = (x, z, r = 2.0) => P.has && Math.hypot(P.sx - x, P.sz - z) < r;
    const rule = (r) => () => setDeathRule(w, r);
    const dressing = (z0, z1, { y = 0, hallW = 11, tall = 16, every = 14 } = {}) => {
      for (let z = z0; z > z1; z -= every) { glassPillar(w, -hallW - 0.6, y, z, { h: tall }); glassPillar(w, hallW + 0.6, y, z, { h: tall }); }
    };
    const gallery = (z0, z1, y = 0, n = 10, seed = 1) => {            // the witnesses' balconies (visual only)
      for (const sx of [-1, 1]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, Math.abs(z1 - z0)), new THREE.MeshStandardMaterial({ color: 0x2a2236, roughness: 0.6, metalness: 0.2 }));
        b.position.set(sx * 15, y - 0.3, (z0 + z1) / 2); w.add(b);
        witnesses(w, { x: sx * 14.6, y: y - 0.1, z0, z1, n, face: sx > 0 ? Math.PI / 2 : -Math.PI / 2, seed: seed + (sx > 0 ? 3 : 0) });
      }
    };

    // ============================================================ 0. the foyer ===================================
    deck(w, { x: 0, y: 0, z: -12, w: 22, d: 36, path: true });                       // z +6 … -30
    sign(w, 'SESSION 15 · ANNIVERSARY GALA', 0, 10.8, -16, { w: 14, h: 1.9 });
    for (const lx of [-9, 9]) { lantern(w, lx, 0, 2); lantern(w, lx, 0, -22); }
    dressing(0, -32); gallery(4, -30, 0, 14, 1);
    chandelier(w, 0, 13, -4); chandelier(w, 0, 13, -22);
    sign(w, 'THE WITNESSES HAVE ARRIVED. THEY ARE NOT HERE FOR YOU.', 0, 5.6, -26, { w: 10, h: 1.4, size: 34 });
    stage(w, 'welcome', { x: 0, y: 1, z: 2, w: 30, h: 4, d: 8 }, () => { tell('p1', 'coop.l15.intro.p1', { priority: 2 }); tell('p2', 'coop.l15.intro.p2', { priority: 2 }); });
    w.checkpoint({ x: 0, y: 0, z: -27, real: true });

    // ============================================================ 1. the mirror hall ============================
    const Hz0 = -30, Hz1 = -42;
    deck(w, { x: 0, y: 0, z: (Hz0 + Hz1) / 2, w: 22, d: 12, path: true });            // entry deck z -30 … -42
    const L = mirrorLanes(w, { y: 0, z0: -45.6, pitch: 5.4, rows: 8, cross: [3, 6, 7], hold: 2.5, restAfter: 4, restLen: 8 });
    const zLast = L.zRow(8);
    const mirrorOn = () => gp().z < -29 && gp().z > zLast - 7;
    mirrorGhost(w, mirrorOn);
    // glass divider between the lanes (the reflection happens in it)
    w.plat({ x: 0, y: 9, z: (Hz1 + zLast - 3) / 2, w: 0.3, d: Math.abs(zLast - 3 - Hz1), h: 9, tex: 'metal', color: 0xcfe6ff, trim: null, edge: null });
    sign(w, 'THE MIRROR. YOUR PARTNER IS BACKWARDS. THE FLOOR IS NOT.', 0, 7.2, -37, { w: 10, h: 1.6, size: 32 });
    sign(w, 'STAND ON A TILE · THE SAME TILE IN THE OTHER LANE RISES', 0, 11.2, -43.6, { w: 10, h: 1.2, size: 30, border: '#' + COL.p1.toString(16).padStart(6, '0') });
    sign(w, 'PINK ROWS ARE THE FUNHOUSE: THE OTHER COLUMN RISES', 0, 11.2, L.zRow(3) + 2.4, { w: 10, h: 1.2, size: 30, border: '#ff6ec7' });
        dressing(-30, -92); gallery(-32, -90, 0, 14, 5);
    chandelier(w, 0, 13, -44); chandelier(w, 0, 13, -62); chandelier(w, 0, 13, -80);
    w.checkpoint({ x: -8.6, y: 0, z: -36.5, real: true });                              // beside the lanes, on the deck
    stage(w, 'mirror', { x: 0, y: 1, z: -38, w: 22, h: 4, d: 5 }, () => { tell('p1', 'coop.l15.mirror', { priority: 2 }); });
    stage(w, 'funhouse', { x: 0, y: 1, z: L.zRow(2) - 1, w: 22, h: 6, d: 4 }, () => tell('all', 'coop.l15.funhouse'));
    // exit deck + the toast hall
    const toastZ0 = zLast - 3.9;                                                      // -76.5
    deck(w, { x: 0, y: 0, z: toastZ0 - 16, w: 22, d: 32, path: true });               // z -76.5 … -108.5
    w.checkpoint({ x: 0, y: 0, z: toastZ0 - 3, real: true });
    stage(w, 'mirrordone', { x: 0, y: 1, z: toastZ0 - 2, w: 22, h: 4, d: 3 }, () => tell('all', 'coop.l15.mirrordone'));
    deck(w, { x: 0, y: 0, z: L.rest.zc, w: 22, d: L.rest.d, path: true });
    w.checkpoint({ x: 0, y: 0, z: L.rest.zc, real: true });
    sign(w, 'HALFWAY. THE MIRRORS ARE STILL WATCHING.', 0, 11.2, L.rest.near - 1.2, { w: 9, h: 1.2, size: 32 });
    {
      const steps = L.botSteps(me, near);
      steps.push({ x: 0, z: toastZ0 - 6, r: 2 });
      B.p1.push(...steps.map((o) => ({ ...o }))); B.p2.push(...steps.map((o) => ({ ...o })));
    }

    // ============================================================ 2. the toast ==================================
    const tz = toastZ0 - 8;                                                           // pedestals at z -84.5
    sign(w, 'THE TOAST · THREE CLINKS · BOTH GLASSES WITHIN HALF A SECOND', 0, 5.8, tz - 6, { w: 12, h: 1.4, size: 32 });
    const lifted = { p1: -99, p2: -99 };
    const glasses = {};
    for (const [role, px] of [['p1', -6], ['p2', 6]]) {
      const g = new THREE.Group(); g.position.set(px, 0, tz); w.add(g);
      const mat = new THREE.MeshStandardMaterial({ color: 0xe8f6ff, roughness: 0.05, transparent: true, opacity: 0.8, emissive: COL[role], emissiveIntensity: 0.35 });
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.12, 0.5, 14), mat); cup.position.y = 1.55; g.add(cup);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), mat); stem.position.y = 1.2; g.add(stem);
      glasses[role] = { cup, stem, k: 0 };
    }
    let lastLate = -99;
    pedestal(w, { x: -6, z: tz, role: 'p1', label: 'RAISE GLASS', color: COL.p1, onPress: () => press() });
    pedestal(w, { x: 6, z: tz, role: 'p2', label: 'RAISE GLASS', color: COL.p2, onPress: () => press() });
    let myLast = -99;
    const press = () => { if (w.t - myLast < 2.2 || c.get('toast', false)) return; myLast = w.t; c.emit('lift', { r: me }); };
    c.onEvent('lift', (a) => {
      lifted[a.r] = w.t; glasses[a.r].k = 1.4;
      const n0 = c.get('toastN', 0);
      if (c.isHost && !c.get('toast', false) && Math.abs(lifted.p1 - lifted.p2) <= 0.5) {
        c.set('toastN', n0 + 1);
        if (n0 + 1 >= 3) c.set('toast', true);
      }
      w.after(0.8, () => { if (!c.get('toast', false) && c.get('toastN', 0) === n0 && w.t - lastLate > 6 && a.r === me) { lastLate = w.t; tell('all', 'coop.l15.toastlate'); } });
    });
    c.on('toastN', (n) => {
      lifted.p1 = lifted.p2 = -99;
      glasses.p1.k = glasses.p2.k = 1.4;
      w.burst(new THREE.Vector3(0, 2.4, tz), 0xffe9a8, 14 + n * 6);
      if (n < 3) tell('all', 'coop.l15.toastround');
    });
    const gT = gate(w, { x: 0, z: tz - 15, w: 22, h: 5, color: 0x9ab8d8, tex: 'metal', glow: 0xbfe6ff });
    c.on('toast', (v) => { gT.set(!!v); if (v) { tell('all', 'coop.l15.toastok'); w.burst(new THREE.Vector3(0, 2.2, tz), 0xffe9a8, 40); } });
    w.updaters.push((dt) => {
      for (const r of ['p1', 'p2']) {
        const q = glasses[r]; q.k = Math.max(0, q.k - dt);
        const up = q.k > 0 || c.get('toast', false) ? 0.7 : 0;
        q.cup.position.y += ((1.55 + up) - q.cup.position.y) * Math.min(1, dt * 10); q.stem.position.y = q.cup.position.y - 0.35;
      }
    });
    stage(w, 'toast', { x: 0, y: 1, z: tz + 3, w: 22, h: 4, d: 4 }, () => tell('all', 'coop.l15.toast'));
    const ap = (role) => [role === 'p1' ? -6 : 6, tz + 2.2];
    {
      const [ax, az] = ap(me), [bx, bz] = ap(OTHER[me]);
      const s = [
        { x: ax, z: az, r: 0.8, until: () => near(ax, az, 1.0) && pnear(bx, bz, 1.6) },
        { x: ax, z: az, r: 0.8, use: true, face: [me === 'p1' ? -6 : 6, tz], until: () => c.get('toast', false) },
        { x: 0, z: tz - 10, r: 1.5, until: () => gT.passable && near(0, tz - 10, 3.5) },
      ];
      B.p1.push(...s.map((o) => ({ ...o }))); B.p2.push(...s.map((o) => ({ ...o })));
    }
    // after the gate: the dance floor entrance
    const dz0 = toastZ0 - 32;                                                         // deck ends here (-108.5)
    w.checkpoint({ x: 0, y: 0, z: tz - 20, real: true });
    chandelier(w, 0, 13, tz - 8);
    dressing(-80, -112); gallery(-82, -108, 0, 10, 9);

    // ============================================================ 3. the quadrille ===============================
    const T = 3.6, ON = 0.8, STEP = 0.28, OFF2 = 0.14;
    const rowsZ = [];                                                                 // centre z of the 8 tiles; a rest deck after the 4th
    let cz = dz0;
    const restZ = {};
    for (let r = 1; r <= 10; r++) {
      cz -= 2.0 + 1.8; rowsZ[r] = cz; cz -= 1.8;
      if (r === 5) { cz -= 2.0; restZ.z0 = cz; cz -= 6; restZ.z1 = cz; restZ.c = (restZ.z0 + restZ.z1) / 2; }
    }
    const endDanceZ = cz;
    const laneX = (role) => (role === 'p1' ? -3.5 : 3.5);
    const elapsedOf = (r, role) => {
      const u = ((w.t / T - STEP * r - (role === 'p2' ? OFF2 : 0)) % 1 + 1) % 1;
      return u * T;
    };
    const leftOf = (r, role) => ON * T - elapsedOf(r, role);
    const dance = [];
    for (const role of ['p1', 'p2']) for (let r = 1; r <= 10; r++) {
      const p = w.plat({ x: laneX(role), y: 0, z: rowsZ[r], w: 5.4, d: 3.6, h: 0.6, tex: 'metal', color: 0xe6d6ff, trim: COL[role], moving: true });
      dance.push({ p, role, r });
    }
    w.updaters.push(() => {
      for (const q of dance) {
        const left = leftOf(q.r, q.role), on = left > 0;
        q.p.body.enabled = on;
        q.p.group.visible = on && (left > 0.8 || Math.sin(w.t * 26) > -0.2);          // a flicker in the last 0.8 s
      }
    });
    deck(w, { x: 0, y: 0, z: restZ.c, w: 22, d: 6, path: true });
    deck(w, { x: 0, y: 0, z: endDanceZ - 6, w: 22, d: 12, path: true });
    sign(w, 'THE QUADRILLE · THE NEXT TILE LIGHTS WHEN IT IS READY · FLICKER = LEAVING', 0, 6.4, dz0 - 1.5, { w: 12, h: 1.6, size: 30 });
    sign(w, 'YOU ARE ON A RIBBON. DANCE CLOSE.', 0, 5.2, restZ.c - 1, { w: 8, h: 1.1, size: 32 });
    w.checkpoint({ x: 0, y: 0, z: dz0 - 0.6, real: true });
    w.checkpoint({ x: 0, y: 0, z: restZ.c, real: true });
    w.checkpoint({ x: 0, y: 0, z: endDanceZ - 4, real: true });
    stage(w, 'dance', { x: 0, y: 1, z: dz0 - 1, w: 22, h: 4, d: 3 }, () => { c.tether({ max: 10.5, k: 12, rope: true, on: true }); tell('all', 'coop.l15.dance'); });
    stage(w, 'danceres', { x: 0, y: 1, z: restZ.c, w: 22, h: 4, d: 5 }, () => tell('all', 'coop.l15.dancemid'));
    stage(w, 'dancedone', { x: 0, y: 1, z: endDanceZ - 3, w: 22, h: 4, d: 4 }, () => { c.tether({ on: false }); tell('all', 'coop.l15.dancedone'); });
    chandelier(w, 0, 13, rowsZ[2]); chandelier(w, 0, 13, rowsZ[6]);
    dressing(-112, endDanceZ - 12); gallery(dz0 - 4, endDanceZ - 10, 0, 14, 11);
    {
      const x = laneX(me), s = [];
      const seq = [{ kind: 'deck', z: dz0 + 0.7 }];
      for (let r = 1; r <= 10; r++) { seq.push({ kind: 'tile', r, z: rowsZ[r] }); if (r === 5) seq.push({ kind: 'deck', z: restZ.c }); }
      seq.push({ kind: 'deck', z: endDanceZ - 4 });
      for (let i = 0; i < seq.length - 1; i++) {
        const cur = seq[i], nxt = seq[i + 1];
        const ready = nxt.kind === 'tile' ? () => { const e = elapsedOf(nxt.r, me); return e < ON * T && e <= 0.98; } : () => leftOf(cur.r, me) > 0.9;
        s.push({ x, z: cur.z, r: 0.7, until: () => near(x, cur.z, 1.0) && ready() });
      }
      s.push({ x: 0, z: endDanceZ - 6, r: 2 });
      B.p1.push(...s.map((o) => ({ ...o }))); B.p2.push(...s.map((o) => ({ ...o })));
    }

    // ============================================================ 4. the speech =================================
    const podZ = endDanceZ - 12;                                                      // podium deck z endDanceZ-12 … -26 (shared with the dance exit)
    const sZ0 = endDanceZ - 12;                                                       // the dance exit deck already covers 12 m; the podium continues it
    deck(w, { x: 0, y: 0, z: sZ0 - 7, w: 22, d: 14, path: true });
    const lecternZ = sZ0 - 7;
    {
      const lec = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 0.9), new THREE.MeshStandardMaterial({ color: 0x4a3326, roughness: 0.6 })); lec.position.set(0, 0.75, lecternZ - 3); w.add(lec);
    }
    const sRoute = { p1: [0, 2, 1, 0, 2], p2: [1, 0, 2, 2, 0] };                           // columns L=0 M=1 R=2 for each walker
    const colName = ['LEFT', 'MIDDLE', 'RIGHT'];
    const sentence = (route) => route.map((k) => colName[k]).join(' · ');
    sign(w, 'THE SPEECH · YOU HEAR THE OTHER ONE\'S ROUTE', 0, 6.4, lecternZ + 1.5, { w: 11, h: 1.5, size: 32 });
    roleSign(w, 'p1', `${N.p2}'s ROUTE (tell them):  ${sentence(sRoute.p2)}`, -6, 3.4, lecternZ - 3, { w: 7.4, h: 1.5, size: 30, rotY: 0.35 });
    roleSign(w, 'p2', `${N.p1}'s ROUTE (tell them):  ${sentence(sRoute.p1)}`, 6, 3.4, lecternZ - 3, { w: 7.4, h: 1.5, size: 30, rotY: -0.35 });
    chandelier(w, 0, 13, lecternZ);
    w.checkpoint({ x: 0, y: 0, z: lecternZ + 3, real: true });
    stage(w, 'speech', { x: 0, y: 1, z: lecternZ + 2, w: 22, h: 4, d: 6 }, () => { tell('p1', 'coop.l15.speech.p1', { priority: 2 }); tell('p2', 'coop.l15.speech.p2', { priority: 2 }); });
    const spZ1 = sZ0 - 14;                                                            // podium far edge
    const colX = (role, k) => (role === 'p1' ? -5 : 5) + (k - 1) * 2.0;
    const spRowZ = (j) => spZ1 - 2.4 - 1.5 - j * 5.4;                                 // j = 0..3
    for (const role of ['p1', 'p2']) for (let j = 0; j < 5; j++) for (let k = 0; k < 3; k++) {
      const pl = w.plat({ x: colX(role, k), y: 0, z: spRowZ(j), w: 1.9, d: 3.0, h: 0.6, tex: 'metal', color: 0xd7ecff, trim: COL[role], path: false });
      if (sRoute[role][j] !== k) w.crumble(pl, { delay: 0.45, gone: 4 });
    }
    w.plat({ x: 0, y: 9, z: (spZ1 + spRowZ(4) - 2) / 2, w: 0.3, d: Math.abs(spZ1 - spRowZ(4)) + 2, h: 9, tex: 'metal', color: 0xcfe6ff, trim: null, edge: null });
    const spEnd = spRowZ(4) - 1.5 - 2.4;
    deck(w, { x: 0, y: 0, z: spEnd - 6, w: 22, d: 12, path: true });                   // exit deck
    w.checkpoint({ x: 0, y: 0, z: spEnd - 3, real: true });
    sign(w, `${N.p1}: THIS LANE`, -5, 3.6, spZ1 - 1.2, { w: 4.6, h: 0.9, size: 34, border: '#' + COL.p1.toString(16) });
    sign(w, `${N.p2}: THIS LANE`, 5, 3.6, spZ1 - 1.2, { w: 4.6, h: 0.9, size: 34, border: '#' + COL.p2.toString(16) });
    stage(w, 'speechdone', { x: 0, y: 1, z: spEnd - 3, w: 22, h: 4, d: 3 }, () => tell('all', 'coop.l15.speechdone'));
    dressing(endDanceZ - 12, spEnd - 12); gallery(spZ1 + 6, spEnd - 8, 0, 14, 13);
    {
      const s = [];
      s.push({ x: me === 'p1' ? -5 : 5, z: lecternZ + 4, r: 1.5 });
      for (let j = 0; j < 5; j++) { const x = colX(me, sRoute[me][j]), z = spRowZ(j); s.push({ x, z, r: 0.5 }); }
      s.push({ x: 0, z: spEnd - 6, r: 2 });
      B.p1.push(...s.map((o) => ({ ...o }))); B.p2.push(...s.map((o) => ({ ...o })));
    }

    // ============================================================ 5a. the callback: hand it across ==============
    const K = carryKit(w);
    const D = [{ n: spEnd, f: spEnd - 12 }];                                          // deck 0 (the speech exit deck) – z near/far edges
    const addDeck = (gap, d, wd = 9) => { const n = D[D.length - 1].f - gap, f = n - d; D.push({ n, f }); deck(w, { x: 0, y: 0, z: (n + f) / 2, w: wd, d, path: true }); return D[D.length - 1]; };
    addDeck(2.8, 8); addDeck(2.8, 8); addDeck(2.8, 8);
    const hubB = addDeck(2.8, 18, 22);
    const NG = D.length - 1;                                                          // 4 gaps
    K.item('tray', 'tray', 'bar', { name: 'Champagne tray' });
    K.station('bar', { x: 0, y: 0, z: D[0].n - 4.5, label: 'Champagne tray', approach: [0, D[0].n - 6.2], accept: ['tray'], color: 0xffc83d });
    const tableZ = hubB.f + 3;
    K.station('table', { x: 0, y: 0, z: tableZ, label: 'The anniversary table', approach: [0, tableZ + 1.8], accept: ['tray'], takeable: () => false, color: 0x39d7c9, onPut: () => c.set('hand', true) });
    const gH = gate(w, { x: 0, z: hubB.f + 0.6, w: 22, h: 5 });
    c.on('hand', (v) => { gH.set(!!v); if (v) tell('all', 'coop.l15.handdone'); });
    sign(w, 'THE TRAY CANNOT JUMP. YOU CAN. HAND IT ACROSS.', 0, 5.4, D[0].n - 2, { w: 10, h: 1.3, size: 32 });
    sign(w, 'TAKE THE TRAY TO THE ANNIVERSARY TABLE', 0, 5.4, hubB.n - 5, { w: 10, h: 1.2, size: 30 });
    w.checkpoint({ x: 0, y: 0, z: D[0].n - 8, real: true });
    w.checkpoint({ x: 0, y: 0, z: D[2].n - 4, real: true });
    w.checkpoint({ x: 0, y: 0, z: hubB.n - 3, real: true });
    stage(w, 'hand', { x: 0, y: 1, z: D[0].n - 3, w: 22, h: 4, d: 4 }, () => tell('all', 'coop.l15.hand'));
    dressing(spEnd - 6, hubB.f - 6); gallery(spEnd - 8, hubB.f, 0, 16, 17);
    chandelier(w, 0, 13, D[1].n - 4); chandelier(w, 0, 13, D[3].n - 4); chandelier(w, 0, 13, hubB.n - 8);
    {
      const X = me === "p1" ? -0.5 : 0.5, XP = -X;
      const edgeF = (i) => D[i].f + 0.45, edgeN = (i) => D[i].n - 0.45;
      const give = (i) => ({ x: X, z: edgeF(i), r: 0.5, face: [() => P.sx, () => P.sz], use: true, until: () => !K.held() });
      const waitAcross = (i) => ({ x: X, z: edgeF(i), r: 0.5, until: () => pnear(XP, edgeN(i + 1), 1.8) });
      const recv = (i) => ({ x: X, z: edgeN(i), r: 0.5, until: () => K.held() === 'tray' });
      const hop = (i) => ({ x: X, z: edgeN(i) - 1.2, r: 0.7 });
      const walkTo = (i) => ({ x: X, z: edgeF(i), r: 0.5 });
      const take = { x: 0, z: D[0].n - 6.2, r: 0.8, face: [0, D[0].n - 4.5], use: true, until: () => K.held() === 'tray' };
      const put = { x: 0, z: tableZ + 1.8, r: 0.8, face: [0, tableZ], use: true, until: () => !K.held() };
      const carrierOf = (g) => (g % 2 === 0 ? 'p1' : 'p2');
      const out = [{ x: X, z: D[0].n - 4, r: 1 }];
      if (me === 'p1') out.push(take);
      for (let g = 0; g < NG; g++) {
        if (carrierOf(g) === me) { out.push(walkTo(g), waitAcross(g), give(g), hop(g + 1)); }
        else { out.push(walkTo(g), hop(g + 1), recv(g + 1)); }
      }
      if (carrierOf(NG) === me) out.push({ x: 0, z: tableZ + 1.8, r: 1 }, put);       // whoever holds the tray at the hub sets it down
      B[me].push(...out);
      both({ x: 0, z: hubB.f - 6, r: 2, until: () => gH.passable && near(0, hubB.f - 6, 3) });
    }
    const hubZ = hubB.f;

    // ============================================================ 5b. the callback: a rope and two ferries =======
    const dockA = hubZ;                                                               // gate is at hubZ+0.6; dock A butts the hub deck
    deck(w, { x: 0, y: 0, z: dockA - 6, w: 22, d: 12, path: true });                 // z dockA … dockA-12
    const eA = dockA - 12, GAP = 11;
    const eB = eA - GAP;
    deck(w, { x: 0, y: 0, z: eB - 6, w: 22, d: 12, path: true });                    // dock B
    const ferries = [];
    for (const [i, fx, off] of [[0, -3.6, 0], [1, 3.6, 4.5]]) {
      const f = w.plat({ x: fx, y: 0, z: eA - 5.5, w: 4.6, d: 5, h: 0.7, moving: true, path: false, tex: 'wood', color: 0xd9c9a0, trim: COL[i ? 'p2' : 'p1'] });
      w.mover(f, (t) => ({ z: -Math.sin(((t + off) / 9) * Math.PI * 2) * 3 }));
      ferries.push({ f, off, x: fx, zAt: (t) => eA - 5.5 - Math.sin(((t + off) / 9) * Math.PI * 2) * 3 });
    }
    sign(w, 'THE FERRIES TAKE TURNS · THE RIBBON IS TIED TO YOU', 0, 6.0, eA + 1.0, { w: 11, h: 1.4, size: 32 });
    w.checkpoint({ x: 0, y: 0, z: dockA - 3, real: true });
    w.checkpoint({ x: 0, y: 0, z: eB - 4, real: true });
    stage(w, 'rope', { x: 0, y: 1, z: dockA - 4, w: 22, h: 4, d: 4 }, () => { c.tether({ max: 17, k: 10, rope: true, on: true }); setDeathRule(w, 'both'); tell('all', 'coop.l15.rope'); });
    stage(w, 'ropedone', { x: 0, y: 1, z: eB - 6, w: 22, h: 4, d: 4 }, () => { c.tether({ on: false }); setDeathRule(w, 'self'); tell('all', 'coop.l15.ropedone'); });
    chandelier(w, 0, 13, eA - 6);
    dressing(hubZ, eB - 14); gallery(dockA, eB - 10, 0, 12, 19);
    {
      // p1 rides the left ferry, p2 the right one (they swing in at different times)
      const fi = me === 'p1' ? 0 : 1, F = ferries[fi], x = F.x;
      const s = [
        { x, z: eA + 1.0, r: 0.5, until: () => near(x, eA + 1.0, 0.9) && F.zAt(w.t) > eA - 3.0 },
        { x, z: () => F.zAt(w.t), r: 0.6, until: () => near(x, F.zAt(w.t), 0.8) && F.zAt(w.t) < eB + 3.0 },
        { x, z: eB - 3, r: 1.0 },
      ];
      B.p1.push(...s.map((o) => ({ ...o }))); B.p2.push(...s.map((o) => ({ ...o })));
    }

    // ============================================================ 5c. the callback: musical chairs ==============
    const cZ0 = eB - 12;                                                              // dock B ends here
    deck(w, { x: 0, y: 0, z: cZ0 - 25, w: 22, d: 50, path: true });                  // z cZ0 … cZ0-50
    const chairSets = [
      { z: cZ0 - 6, beat: 1e9, hold: 7, px: 5 },          // your colour, fixed
      { z: cZ0 - 20, beat: 7, hold: 7, px: 5 },           // the colours swap every 7 s
      { z: cZ0 - 34, beat: 5, hold: 6, px: 7 },           // faster, and the pads are wider apart
    ];
    for (const cs of chairSets) {
      cs.pl = chairPlates(w, { pads: [{ x: -cs.px, z: cs.z }, { x: cs.px, z: cs.z }], beat: cs.beat, hold: cs.hold });
      cs.gate = gate(w, { x: 0, z: cs.z - 6, w: 22, h: 5 });
      cs.open = 0;
      w.updaters.push((dt) => { cs.open = cs.pl.pressed ? cs.hold : Math.max(0, cs.open - dt); cs.gate.set(cs.open > 0); });
    }
    const padZ2 = chairSets[2].z;
    sign(w, 'STAND ON YOUR COLOUR · TOGETHER · THEN RUN', 0, 5.8, chairSets[0].z + 3.5, { w: 11, h: 1.3, size: 32 });
    sign(w, 'THE COLOURS HAVE DECIDED TO DANCE. SO WILL YOU.', 0, 5.8, chairSets[1].z + 3.5, { w: 11, h: 1.3, size: 32 });
    sign(w, 'FASTER. THE PADS ARE FURTHER APART. SO, OBVIOUSLY, ARE YOU.', 0, 5.8, chairSets[2].z + 3.5, { w: 11, h: 1.3, size: 30 });
    w.checkpoint({ x: 0, y: 0, z: cZ0 - 3, real: true });
    w.checkpoint({ x: 0, y: 0, z: chairSets[0].z - 10, real: true });
    w.checkpoint({ x: 0, y: 0, z: chairSets[1].z - 10, real: true });
    stage(w, 'chairs', { x: 0, y: 1, z: chairSets[0].z + 3, w: 22, h: 4, d: 4 }, () => tell('all', 'coop.l15.chairs'));
    stage(w, 'chairs2', { x: 0, y: 1, z: chairSets[1].z + 3, w: 22, h: 4, d: 4 }, () => tell('all', 'coop.l15.chairs2'));
    stage(w, 'chairs3', { x: 0, y: 1, z: chairSets[2].z + 3, w: 22, h: 4, d: 4 }, () => tell('all', 'coop.l15.chairs3'));
    for (const cs of chairSets) chandelier(w, 0, 13, cs.z);
    dressing(eB - 12, cZ0 - 54); gallery(cZ0 - 2, cZ0 - 48, 0, 16, 23);
    {
      const s = [];
      chairSets.forEach((cs, idx) => {
        const myPad = () => (cs.pl.roleAt(0, cs.pl.left() < 2 ? w.t + 2.1 : w.t) === me ? 0 : 1);
        s.push({ x: () => (idx === 0 ? (me === 'p1' ? -cs.px : cs.px) : myPad() === 0 ? -cs.px : cs.px), z: cs.z, r: 0.9, until: () => cs.pl.pressed });
        s.push({ x: 0, z: cs.z - 12, r: 1.5, until: () => cs.gate.passable && near(0, cs.z - 12, 3) });
      });
      B.p1.push(...s.map((o) => ({ ...o }))); B.p2.push(...s.map((o) => ({ ...o })));
    }

    // ============================================================ 6. the cake tower ==============================
    const baseZ = padZ2 - 12;                                                         // base deck of the tower
    const tw0 = baseZ - 0;
    deck(w, { x: 0, y: 0, z: tw0 - 8, w: 22, d: 16, path: true });                    // z tw0 … tw0-16
    sign(w, 'THE CAKE · FOUR TIERS · IF ONE FALLS, YOU BOTH DO', 0, 6.0, tw0 - 1.5, { w: 11, h: 1.4, size: 32 });
    w.checkpoint({ x: 0, y: 0, z: tw0 - 8, real: true });
    stage(w, 'tower', { x: 0, y: 1, z: tw0 - 3, w: 22, h: 4, d: 4 }, () => { setDeathRule(w, 'both'); tell('all', 'coop.l15.tower'); });
    dressing(padZ2 - 6, tw0 - 20, { tall: 22 }); gallery(tw0 - 1, tw0 - 15, 0, 10, 29);
    let ty = 0, tzc = tw0 - 16;
    const stairs = (n, o = {}) => {
      const specs = Array.from({ length: n }, (_, i) => ({ gap: i === 0 && o.first ? o.first : 1.6, d: 3.2, w: o.w ?? 5, dy: 1.1, x: o.zig ? (i % 2 ? 3 : -3) * (o.zig) : undefined }));
      const ch = chain(w, { x: 0, y: ty, z: tzc }, specs);
      ty = ch.endY; tzc = ch.endZ; return ch;
    };
    const landing = (d = 8) => { const p = deck(w, { x: 0, y: ty, z: tzc - 1.8 - d / 2, w: 12, d, path: true }); w.checkpoint({ x: 0, y: ty, z: tzc - 1.8 - d / 2, real: true }); tzc = tzc - 1.8 - d; return p; };
    // tier 1: plain stairs, two macarons that fall away
    const t1 = stairs(10, { first: 1.6 });
    w.crumble(t1[2], { delay: 1.0, gone: 3 }); w.crumble(t1[5], { delay: 1.0, gone: 3 });
    w.checkpoint({ x: 0, y: t1[3].top, z: t1[3].body.z, real: true });
    w.checkpoint({ x: 0, y: t1[7].top, z: t1[7].body.z, real: true });
    landing();
    // tier 2: zig-zag
    const t2 = stairs(10, { w: 4.4, zig: 0.6 });
    w.checkpoint({ x: t2[3].body.x, y: t2[3].top, z: t2[3].body.z, real: true });
    w.checkpoint({ x: t2[7].body.x, y: t2[7].top, z: t2[7].body.z, real: true });
    stage(w, 'towermid', { x: 0, y: ty - 3, z: tzc + 3, w: 22, h: 12, d: 10 }, () => tell('all', 'coop.l15.towermid'));
    landing();
    // tier 3: candle lift, then more stairs, and the weather turns
    const y3 = ty, z3 = tzc;
    const elev = w.plat({ x: 0, y: y3, z: z3 - 1 - 2.5, w: 5, d: 5, h: 0.7, moving: true, path: true, tex: 'wood', color: 0xf3e6c8 });
    w.mover(elev, (t) => ({ y: 2.4 + 2.4 * Math.sin((t / 7) * Math.PI * 2 - Math.PI / 2) }));
    ty = y3 + 4.8; tzc = z3 - 1 - 5;
    const lt = deck(w, { x: 0, y: ty, z: tzc - 1 - 4, w: 12, d: 8, path: true }); tzc = tzc - 1 - 8;
    w.checkpoint({ x: 0, y: ty, z: lt.body.z, real: true });
    const t3 = stairs(6, { w: 4.5 });
    w.crumble(t3[3], { delay: 1.0, gone: 3 });
    w.checkpoint({ x: 0, y: t3[2].top, z: t3[2].body.z, real: true });
    stage(w, 'storm', { x: 0, y: y3 + 3, z: z3 - 4, w: 22, h: 14, d: 8 }, () => { storm.on = true; tell('all', 'coop.l15.storm'); });
    landing();
    // tier 4: narrow stairs to the ring
    const t4 = stairs(10, { w: 3.6 });
    w.crumble(t4[3], { delay: 1.0, gone: 3 }); w.crumble(t4[6], { delay: 1.0, gone: 3 });
    w.checkpoint({ x: 0, y: t4[2].top, z: t4[2].body.z, real: true });
    w.checkpoint({ x: 0, y: t4[5].top, z: t4[5].body.z, real: true });
    w.checkpoint({ x: 0, y: t4[8].top, z: t4[8].body.z, real: true });
    const top = deck(w, { x: 0, y: ty + 1.2, z: tzc - 1.8 - 7, w: 14, d: 14, path: true });
    const gy = ty + 1.2, gz = tzc - 1.8 - 7;
    w.goal({ x: 0, y: gy, z: gz });
    beacon(w, 0, gy, gz, 0xffe9a8, 22);
    for (const lx of [-5, 5]) lantern(w, lx, gy, gz + 2);
    sign(w, 'BOTH OF YOU. IN THE RING. THE WITNESSES ARE WATCHING.', 0, gy + 5.4, gz - 4, { w: 10.5, h: 1.6, size: 32 });
    stage(w, 'circle', { x: 0, y: gy + 1, z: gz + 4, w: 14, h: 4, d: 6 }, () => tell('all', 'coop.l15.circle'));
    w.checkpoint({ x: 0, y: gy, z: gz + 5, real: true });
    void top;
    chandelier(w, 0, gy + 9, gz + 6);
    // witnesses crowd the top (they have climbed the stairs too)
    witnesses(w, { x: -9, y: gy - 0.1, z0: gz + 5, z1: gz - 5, n: 6, face: -Math.PI / 2, seed: 31 });
    witnesses(w, { x: 9, y: gy - 0.1, z0: gz + 5, z1: gz - 5, n: 6, face: Math.PI / 2, seed: 37 });
    both({ follow: true });

    // the storm: lighting only
    const storm = { on: false, k: 0 };
    {
      const U = w.skyUniforms, a = { top: U.uTop.value.clone(), hor: U.uHorizon.value.clone(), bot: U.uBottom.value.clone(), fog: w.scene.fog.color.clone(), sun: w.sun.intensity, hemi: w.hemi.intensity };
      const b = { top: new THREE.Color(0x1d2433), hor: new THREE.Color(0x5a6682), bot: new THREE.Color(0x1a1f2b), fog: new THREE.Color(0x445068) };
      w.updaters.push((dt) => {
        if (!storm.on || storm.k >= 1) return;
        storm.k = Math.min(1, storm.k + dt / 8);
        U.uTop.value.copy(a.top).lerp(b.top, storm.k); U.uHorizon.value.copy(a.hor).lerp(b.hor, storm.k); U.uBottom.value.copy(a.bot).lerp(b.bot, storm.k);
        w.scene.fog.color.copy(a.fog).lerp(b.fog, storm.k); w.scene.background?.copy?.(w.scene.fog.color);
        w.sun.intensity = a.sun + (0.9 - a.sun) * storm.k; w.hemi.intensity = a.hemi + (0.55 - a.hemi) * storm.k;
      });
    }

    w.hooks.onPartnerDeath = () => { tell('all', 'coop.l15.partnerdown'); return true; };
    galaBots(w, B);
  },
};
