import * as THREE from 'three';
import { glowMaterial } from '../../engine/materials.js';
import { retreatEnv, plate, riser, lever, sign, lantern, lake, stage, botSteps, beacon, roleSign, COL } from './kit.js';
import { frame, nextFrame, partnerAt, luggageStacks, cloudBank, crateTag, beltPlat, hangRope, pennant } from './baggage-kit.js';

// Session 9 — Shared Baggage. A very tall pile of each other's problems, climbed on a mile of luggage.
// Stages (each turns back over the last one, so the route stacks up into a tower; ~115 m in all):
//   1 head-boost walls · 2 counterweight pulleys · 3 swinging suitcases · 4 baggage carousel (stop the belt for them)
//   5 lifts you work for each other · 6 gusts on a beam, on a rope · 7 fragile stones, one of you at a time
//   8 lying signs and a fake summit · 9 a quick recap of everything, then the real top.
// Death rule: both (a fall costs the pair a trip back to the last checkpoint, which is never far).

export default {
  id: 'coop9',
  name: 'Shared Baggage',
  music: 'l1',
  deathRule: 'both',
  completeQuip: 'You carried each other to the top. The luggage stays with you. All of it.',
  titleCam: { center: [0, 40, -30], radius: 70, height: 40 },

  build(w, game) {
    retreatEnv(w, { mood: 'dawn' });
    w.killY = -14;
    lake(w, -75, 900);
    const c = w.coop, me = c.me, N = c.names, P = c.partner, g = game;
    const tell = (r, k, o) => c.tell(r, k, o);
    const bots = { p1: [], p2: [] };
    const add = (role, ...steps) => bots[role].push(...steps);
    const both = (...steps) => { add('p1', ...steps); add('p2', ...steps); };
    // bot recovery: after a fall both respawn at a checkpoint, so each bot rewinds its script to where it stood when that checkpoint was reached
    const marks = []; w.dbgMarks = marks;
    const mark = (yy) => marks.push({ y: yy, p1: bots.p1.length, p2: bots.p2.length });
    const cpRecs = []; let openCp = [];
    const closeCps = () => { for (const r of openCp) { r.p1 = bots.p1.length; r.p2 = bots.p2.length; } openCp = []; };
    const origCp = w.checkpoint.bind(w);
    w.checkpoint = (o) => { closeCps(); const r = origCp(o); if (o.real !== false) { const rec = { x: o.x, y: o.y, z: o.z }; cpRecs.push(rec); openCp.push(rec); } return r; };
    w.onRespawn(() => {
      if (!w.botSetIndex) return;
      const pp = g.player;
      let near = null, nd = 3;
      let best = null;
      for (const m of marks) if (m.y <= pp.y + 0.5 && (!best || m.y > best.y)) best = m;       // equal heights keep the earliest mark
      if (best) w.botSetIndex(best[me]);
    });
    const pl = () => g.player;
    const feet = (yy, tol = 0.35) => pl().grounded && Math.abs(pl().y - yy) < tol;
    /** the local player is up on ledge level yy and past local s */
    const reached = (F, s, yy) => () => feet(yy) && F.S(pl().z) > s;
    const partnerUp = (F, s, yy) => () => P.has && P.g && Math.abs(P.sy - yy) < 0.4 && F.S(P.sz) > s;
    const raiseKill = (yy) => { w.killY = Math.max(w.killY, yy); };

    let beatN = 0;
    /** one-shot beat at the first deck of a stage: fn runs once on both machines */
    const beat = (F, s0, yy, fn) => stage(w, 'b' + (beatN++), { x: F.X(0), y: yy + 2.5, z: F.Z(s0 + 3), w: 18, h: 7, d: 8 }, fn);

    // ===================================================================== 1. trunk walls: head-boost steps ==
    // bot-only assist: a bot cannot steer a hop onto a head in mid-air, so once it is above head height it is pointed at the head
    let hopAssisted = false;
    const hopX = (F, y, Ws) => {
      const p = pl();
      if (p.grounded) hopAssisted = false;
      if (p.y < y + 1.1) return F.X(0.85);
      if (!p.grounded && !hopAssisted && p.y > y + 1.85 && P.has) {
        const t = (p.vy + Math.sqrt(p.vy * p.vy + 52 * (p.y - (y + 1.8)))) / 26;
        p.vx = (P.sx - p.x) / t; p.vz = (P.sz - p.z) / t; hopAssisted = true;
      }
      return P.sx;
    };
    const headWalls = (F, y0, a0, lowerLen, n) => {
      const W0 = a0 + lowerLen;
      F.plat(w, a0, W0, y0, { path: true, h: 0.8, color: 0xd9c9a0 });
      for (let k = 0; k < n; k++) {
        const y = y0 + 3 * k, Ws = W0 + 14 * k, boost = k % 2 ? 'p1' : 'p2', climb = k % 2 ? 'p2' : 'p1';
        F.plat(w, Ws, Ws + 14, y + 3, { path: true, h: 3, color: k % 2 ? 0xcfb485 : 0xd9c9a0 });                    // the far side of the wall
        w.plat({ tex: 'wood', color: 0xb98a55, x: F.X(1.75), y: y + 1.2, z: F.Z(Ws - 1.25), w: 2.5, d: 2.5, h: 1.2 });       // the small trunk to climb on first
        const lift = riser(w, { x: F.X(5.5), y: y + 3, z: F.Z(Ws - 4), w: 3.2, d: 3.2, h: 0.6, drop: 3, always: true, speed: 4.2, color: 0xe9d9b0, trim: COL.good });
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.4, 10), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8 }));
        col.position.set(F.X(5.5), y + 1.2, F.Z(Ws - 2.0)); w.add(col);
        const pz = plate(w, { x: F.X(0), y: y + 3, z: F.Z(Ws + 10), need: 'any', label: 'LIFT: STAND HERE' });
        w.updaters.push(() => lift.set(pz.pressed));
        sign(w, k ? 'THIS ONE IS ALSO 3 M. YOU ARE NOW EACH OTHER\'S STAIRS.' : 'THIS WALL IS 3 M. YOUR JUMP IS 1.4 M.', F.X(0), y + 6.4, F.Z(Ws - 0.4), { w: 11, h: 1.2 });
        sign(w, 'STAND ON THE LIFT. THE OTHER ONE STANDS ON THE PLATE.', F.X(5.5), y + 6.0, F.Z(Ws - 3.2), { w: 6.4, h: 1.6, size: 34 });
        w.checkpoint({ x: F.X(0), y: y + 3, z: F.Z(Ws + 5), real: true });
        const inPlace = () => P.has && Math.abs(P.sz - F.Z(Ws - 0.5)) < 0.8 && Math.abs(P.sx - F.X(0)) < 0.9;
        add(boost,
          { x: F.X(-1.2), z: F.Z(Ws - 4), r: 1 },
          { x: F.X(0), z: F.Z(Ws - 0.5), r: 0.25, until: () => P.has && P.sy > y + 2.7 },
          { x: F.X(5.5), z: F.Z(Ws - 4), until: () => pl().y > y + 2.7 });
        add(climb,
          { x: F.X(0.85), z: F.Z(Ws - 0.5), r: 0.12, until: () => pl().y > y + 1.1 && pl().grounded && inPlace() && Math.abs(pl().x - F.X(0.85)) < 0.3 && Math.abs(pl().vx) + Math.abs(pl().vz) < 0.4 },
          { x: () => hopX(F, y, Ws), z: () => (pl().y < y + 1.1 ? F.Z(Ws - 0.5) : P.sz), r: 0.08, get jump() { return pl().y < y + 1.1 ? false : 1.1; }, until: () => pl().y > y + 1.65 && pl().grounded },
          { x: F.X(0), z: F.Z(Ws + 4), jump: 3, until: () => pl().y > y + 2.8 && pl().grounded },
          { x: F.X(0), z: F.Z(Ws + 10), until: () => P.has && P.sy > y + 2.7 });
      }
      return { s: W0 + 14 * n, y: y0 + 3 * n, len: 14 };
    };

    // ===================================================================== 2. counterweight pulleys ==========
    const pulleys = (F, y0, a0, rounds) => {
      let cs = a0, cy = y0;
      F.plat(w, cs, cs + 10, cy, { path: true, h: 0.8, color: 0xd9c9a0 });
      for (let k = 0; k < rounds; k++) {
        const s = cs, y = cy;
        const rider = k % 2 ? 'p2' : 'p1', weight = k % 2 ? 'p1' : 'p2', H = 6;
        const cartL = riser(w, { x: F.X(-3), y: y + H, z: F.Z(s + 12.2), w: 4.4, d: 4.4, h: 0.8, drop: H, always: true, speed: 3.5, color: 0xd9c9a0, trim: COL[rider] });
        const cartR = riser(w, { x: F.X(3), y: y + H, z: F.Z(s + 12.2), w: 4.4, d: 4.4, h: 0.8, drop: H, always: true, speed: 3.5, color: 0xd9c9a0, trim: COL[weight] });
        F.plat(w, s + 14.4, s + 24.4, y + H, { path: true, h: 2, color: 0xd9c9a0 });
        const pan = plate(w, { x: F.X(-6), y, z: F.Z(s + 3), need: 'any', size: 2.4, label: `${N[weight]}: THE WEIGHT` });
        const pan2 = plate(w, { x: F.X(6), y: y + H, z: F.Z(s + 14.4 + 3), need: 'any', size: 2.4, label: `${N[rider]}: THE WEIGHT` });
        w.updaters.push(() => { cartL.set(pan.pressed); cartR.set(pan2.pressed); });
        // wheel and ropes (set dressing): each cart hangs from its own pan
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 0.7 }));
        wheel.rotation.z = Math.PI / 2; wheel.position.set(F.X(0), y + H + 9, F.Z(s + 12.2)); w.add(wheel);
        for (const [cx, px, py, ps] of [[-3, -6, y + 1.2, s + 3], [3, 6, y + H + 1.2, s + 17.4]]) {
          const ge = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(F.X(cx), y + H + 8.0, F.Z(s + 12.2)), new THREE.Vector3(F.X(px), py, F.Z(ps))]);
          w.add(new THREE.Line(ge, new THREE.LineBasicMaterial({ color: 0xd8c9a0, transparent: true, opacity: 0.7 })));
        }
        w.checkpoint({ x: F.X(0), y: y + H, z: F.Z(s + 14.4 + 6), real: true });
        const onCartL = () => partnerAt(P, F, -3, s + 12.2, y - 0.5, y + 1.2, 2.1);
        const pastCarts = () => P.has && P.sy > y + H - 0.4 && P.g && F.S(P.sz) > s + 14.9;
        const meUp = () => pl().y > y + H - 0.5 && pl().grounded;
        if (k > 0) mark(y);                                                                    // a respawn on this round's start deck replays from here
        const onCartR = () => partnerAt(P, F, 3, s + 12.2, y - 0.5, y + 1.2, 2.1);
        add(rider,
          { x: F.X(-3), z: F.Z(s + 12.2), r: 0.5, until: meUp },
          { x: F.X(0), z: F.Z(s + 19.5), r: 1.5, until: onCartR },                              // wait up top until the partner is standing on their cart
          { x: F.X(6), z: F.Z(s + 17.4), r: 0.4, until: pastCarts });
        add(weight,
          { x: F.X(-6), z: F.Z(s + 6.5), r: 0.5, until: onCartL },
          { x: F.X(-6), z: F.Z(s + 3), r: 0.4, until: pastCarts },
          { x: F.X(3), z: F.Z(s + 12.2), r: 0.5, until: meUp });
        cs += 14.4; cy += H;
      }
      return { s: cs + 10, y: cy, len: 10 };
    };

    // ===================================================================== 3. swinging suitcases =============
    const ladder = (F, y0, a0, units) => {
      const A = 3.0, step = 0.95;
      F.plat(w, a0, a0 + 8, y0, { x: -6.5, w: 3, path: true, h: 0.6, color: 0xd9c9a0, trim: COL.good });
      let y = y0, brakeRate = 1, off = 0;
      const ledges = [{ y: y0, side: -1 }];
      const braked = [], pend = [];
            for (let u = 0; u < units; u++) {
        const hasBrake = u >= 2;
        y += step;
        const T = hasBrake ? 2.6 : 5.0, ph0 = u * 1.7 + 0.4;
        const pp = w.plat({ tex: 'wood', color: 0xc2873c, x: F.X(0), y, z: F.Z(a0 + (u % 2 ? 5.8 : 2.2)), w: 3, d: 3, h: 0.6, moving: true, path: true, trim: hasBrake ? COL.danger : 0xffc83d });
        const st = { off: 0 };
        const phase = () => ph0 + (2 * Math.PI / T) * w.t - st.off;
        w.mover(pp, () => ({ x: A * Math.sin(phase()) }));
        if (hasBrake) braked.push({ st, T });
        hangRope(w, pp, y0 + 20 + u * 2, 1.2);
        y += step;
        const side = u % 2 === 0 ? 1 : -1;                       // right, left, right, left …
        const lp = F.plat(w, a0, a0 + 8, y, { x: side * 6.5, w: 3, path: true, h: 0.6, color: 0xd9c9a0, trim: COL.good });
        ledges.push({ y, side, plat: lp });
        pend.push(pp);
      }
      // brake plates sit on the ledge before the heavy pair (index 2) and on the last ledge
      const iB = 2, iEnd = units;
      const plA = plate(w, { x: F.X(ledges[iB].side * 6.5), y: ledges[iB].y, z: F.Z(a0 + 1.4), need: 'any', size: 1.9, label: 'BRAKE' });
      const plB = plate(w, { x: F.X(ledges[iEnd].side * 6.5), y: ledges[iEnd].y, z: F.Z(a0 + 1.4), need: 'any', size: 1.9, label: 'BRAKE' });
      const ledgeSpot0 = (i, sz) => ({ x: F.X(ledges[i].side * 6.5), z: F.Z(a0 + sz) });
      w.updaters.push((dt) => {
        const target = plA.pressed || plB.pressed ? 0.4 : 1;
        brakeRate += (target - brakeRate) * Math.min(1, dt * 4);
        for (const b of braked) b.st.off += (2 * Math.PI / b.T) * (1 - brakeRate) * dt;
      });
      for (const iL of [iB, iEnd]) w.checkpoint({ x: F.X(ledges[iL].side * 6.5), y: ledges[iL].y, z: F.Z(a0 + 6.2), real: true });
      sign(w, 'THE SUITCASES SWING. THE ROPES DO NOT LIE.', F.X(0), y0 + 6, F.Z(a0 + 4), { w: 9, h: 1.2 });
      sign(w, 'THESE ONES ARE FAST. SOMEONE STANDS ON THE BRAKE.', F.X(0), ledges[iB].y + 6, F.Z(a0 + 4), { w: 10, h: 1.2, border: '#ff4d5e' });
      // bots: p1 crosses first (hop on at the ledge edge when the suitcase is next to it, hop off when it reaches the far ledge);
      // p2 follows, except in the braked pair where p2 stands on the brake at ledge iB and p1 holds the other brake at the end
      const onLedge = (i) => () => feet(ledges[i].y) && Math.abs(pl().x - F.X(ledges[i].side * 6.5)) < 2.2;
      const ox = (u) => pend[u].body.x - F.X(0);
      const pzu = (u) => F.Z(a0 + (u % 2 ? 5.8 : 2.2));
      const hop = (u, gate = null) => {
        const sd = ledges[u].side;
        return [
          { x: F.X(sd * 5.4), z: pzu(u), r: 0.3, until: () => (!gate || gate()) && sd * ox(u) > 2.0 && onLedge(u)() },                         // wait at the ledge edge until the suitcase swings over
          { x: () => pend[u].body.x, z: pzu(u), r: 0.1, jump: 4, until: () => pl().grounded && pl().ground === pend[u].body },                // hop on
          { x: F.X(-sd * 5.4), z: pzu(u), r: 0.1, stop: 0.2, jump: 7, until: () => sd * ox(u) < -2.0 && false },                           // (replaced below)
        ];
      };
      const crossOver = (u) => {
        const sd = ledges[u].side;
        return [
          { x: () => pend[u].body.x, z: pzu(u), r: 0.2, until: () => sd * ox(u) < -2.0 || onLedge(u + 1)() },                                   // ride until it is over by the far ledge
          { x: F.X(-sd * 6.0), z: pzu(u), r: 0.2, jump: 8, until: onLedge(u + 1) },                                                          // hop off
        ];
      };
      const unit = (u, gate = null) => [hop(u, gate)[0], hop(u)[1], ...crossOver(u)];
      const aboveEnd = () => P.has && P.g && Math.abs(P.sy - ledges[iEnd].y) < 0.4 && Math.abs(P.sx - F.X(ledges[iEnd].side * 6.5)) < 2.4;
      const p1On = (u) => () => P.has && P.g && Math.abs(P.sy - ledges[u].y) < 0.4;
      both({ x: F.X(-6.5), z: F.Z(a0 - 1.8), r: 1.0 });                                      // line up with the first ledge (the others stick out past the deck edge)
      both({ x: F.X(-6.5), z: F.Z(a0 + 1.0), r: 0.8, until: onLedge(0) });
      add('p1', ...unit(0), ...unit(1));
      add('p2', { x: F.X(-6.5), z: F.Z(a0 + 1.0), r: 0.8, until: p1On(1) }, ...unit(0), { x: F.X(ledges[1].side * 6.5), z: F.Z(a0 + 1.0), r: 0.8, until: p1On(2) }, ...unit(1));
      // braked pair: p2 stands on the brake at ledge iB (plate plA); p1 crosses, then holds the end brake (plate plB)
      add('p2', { ...ledgeSpot0(iB, 1.4), r: 0.4, until: () => plB.pressed });
      add('p1', { x: F.X(ledges[iB].side * 6.5), z: F.Z(a0 + 6.2), r: 0.6, until: () => plA.pressed }, ...unit(2, () => plA.pressed), ...unit(3), { ...ledgeSpot0(iEnd, 1.4), r: 0.4, until: aboveEnd });
      add('p2', ...unit(2), ...unit(3), { x: F.X(ledges[iEnd].side * 6.5), z: F.Z(a0 + 5.5), r: 0.5, until: () => !plB.pressed });      // stay on the end ledge until the partner has seen us and come off the brake
      return { s: a0 + 8, y, len: 8, ledges };
    };

    // ===================================================================== 4. baggage carousel ===============
    const belts = (F, y0, a0, tiers, firstP2 = true) => {
      const V = 7.5;
      F.plat(w, a0, a0 + 6, y0, { path: true, h: 1.2, color: 0xd9c9a0 });
      let s = a0 + 6, y = y0;
      for (let i = 1; i <= tiers; i++) {
        const bs = s, last = i === tiers;
        const belt = beltPlat(w, { x: F.X(0), y, z: F.Z(bs + 4), w: 6, d: 8, h: 0.6, path: true }, F.dz * V);
        for (let b = 0; b < 4; b++) w.plat({ tex: 'metal', color: 0x2a2d3a, x: F.X(0), y: y + 2.35, z: F.Z(bs + 1 + b * 2), w: 6.4, d: 0.5, h: 0.4 });          // low bars: no bunny-hopping the belt
        const yN = y + 1;
        F.plat(w, bs + 8, bs + (last ? 18 : 12), yN, { path: true, h: 1.2, color: 0xd9c9a0 });
        const SP = plate(w, { x: F.X(-5.5), y, z: F.Z(bs - 1.8), need: 'any', size: 1.9, label: 'STOP THE BELT' });
        const EP = plate(w, { x: F.X(5.5), y: yN, z: F.Z(bs + 9.4), need: 'any', size: 1.9, label: 'STOP THE BELT' });
        w.updaters.push((dt) => { const t = SP.pressed || EP.pressed ? 0 : 1; belt.rate += (t - belt.rate) * Math.min(1, dt * 10); });
        sign(w, 'THE BELT RUNS FASTER THAN YOU DO.', F.X(0), y + 4.2, F.Z(bs + 4), { w: 8, h: 1, size: 32 });
        if (i === 2 || last) w.checkpoint({ x: F.X(0), y: yN, z: F.Z(bs + (last ? 14 : 10)), real: true });
        const first = (i % 2 === 1) === firstP2 ? 'p2' : 'p1', second = first === 'p2' ? 'p1' : 'p2';
        (w.dbgBelts ||= []).push({ SP, EP, first: null, bs });
        const onN = () => feet(yN) && F.S(pl().z) > bs + 8.4;
        const partnerOnN = partnerUp(F, bs + 8.4, yN);
        add(first,
          { x: F.X(0), z: F.Z(bs - 0.9), r: 0.7, until: () => SP.pressed },
          { follow: true, until: onN },
          { x: F.X(5.5), z: F.Z(bs + 9.4), r: 0.4, until: partnerOnN });
        add(second,
          { x: F.X(-5.5), z: F.Z(bs - 1.8), r: 0.4, until: partnerOnN },
          { x: F.X(0), z: F.Z(bs - 0.9), r: 0.7, until: () => EP.pressed },
          { follow: true, until: onN });
        s = bs + (last ? 18 : 12); y = yN;
      }
      return { s, y, len: 10 };
    };

    // ===================================================================== 5. lifts you work for each other ==
    const elevators = (F, y0, a0, rounds, H = 12, startRider = 'p1') => {
      let cs = a0, cy = y0;
      F.plat(w, cs, cs + 6, cy, { path: true, h: 0.8, color: 0xd9c9a0 });
      for (let k = 0; k < rounds; k++) {
        const s = cs, y = cy;
        const rider = (k % 2 === 0) === (startRider === 'p1') ? 'p1' : 'p2', oper = rider === 'p1' ? 'p2' : 'p1';
        const zL = F.Z(s + 8.2);
        const liftL = riser(w, { x: F.X(-4.5), y: y + H, z: zL, w: 4.4, d: 4.4, h: 0.8, drop: H, always: true, speed: 4, color: 0xcfc6b0, trim: COL[rider] });
        const liftR = riser(w, { x: F.X(4.5), y: y + H, z: zL, w: 4.4, d: 4.4, h: 0.8, drop: H, always: true, speed: 4, color: 0xcfc6b0, trim: COL[oper] });
        F.plat(w, s + 10.4, s + 20.4, y + H, { path: true, h: 2, color: 0xd9c9a0 });
        for (const lx of [-4.5, 4.5]) for (const [dx, dsz] of [[-2.4, 6.0], [2.4, 6.0], [-2.4, 10.4], [2.4, 10.4]]) {
          const pil = new THREE.Mesh(new THREE.BoxGeometry(0.3, H + 3, 0.3), new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.6, metalness: 0.4 }));
          pil.position.set(F.X(lx + dx), y + (H + 3) / 2 - 0.5, F.Z(s + dsz)); w.add(pil);
        }
        const lA = lever(w, { x: F.X(-1), y, z: F.Z(s + 2.5), key: `l9e${a0}_${k}a`, label: `Send ${N[rider]} up` }, (on) => liftL.set(on));
        const lB = lever(w, { x: F.X(1), y: y + H, z: F.Z(s + 10.4 + 7.5), key: `l9e${a0}_${k}b`, label: `Send ${N[oper]} up` }, (on) => liftR.set(on));
        sign(w, `${N[rider]} RIDES THIS ONE`, F.X(-4.5), y + 3.2, F.Z(s + 6.2), { w: 4.4, h: 0.8, size: 30, border: '#' + COL[rider].toString(16).padStart(6, '0') });
        sign(w, `${N[oper]} RIDES THIS ONE`, F.X(4.5), y + 3.2, F.Z(s + 6.2), { w: 4.4, h: 0.8, size: 30, border: '#' + COL[oper].toString(16).padStart(6, '0') });
        w.checkpoint({ x: F.X(0), y: y + H, z: F.Z(s + 10.4 + 4.5), real: true });
        const onL = () => partnerAt(P, F, -4.5, s + 8.2, y - 0.5, y + 1.3, 2.2);
        const onR = () => partnerAt(P, F, 4.5, s + 8.2, y - 0.5, y + 1.3, 2.2);
        const up = () => pl().y > y + H - 0.6;
        const topSafe = () => P.has && P.g && P.sy > y + H - 0.6 && F.S(P.sz) > s + 10.8;
        add(rider,
          { x: F.X(-4.5), z: zL, r: 0.6, until: up },
          { x: F.X(1), z: F.Z(s + 10.4 + 7.5), r: 0.9, until: onR },
          { x: F.X(1), z: F.Z(s + 10.4 + 7.5), r: 0.9, use: true, until: () => lB.on },
          { x: F.X(0), z: F.Z(s + 10.4 + 5), r: 0.8, until: topSafe });
        add(oper,
          { x: F.X(-1), z: F.Z(s + 2.5), r: 0.9, until: onL },
          { x: F.X(-1), z: F.Z(s + 2.5), r: 0.9, use: true, until: () => lA.on },
          { x: F.X(4.5), z: zL, r: 0.6, until: up },
          { x: F.X(4.5), z: F.Z(s + 12.5), r: 0.8, until: () => F.S(pl().z) > s + 10.6 });
        cs += 10.4; cy += H;
      }
      return { s: cs + 10, y: cy, len: 10 };
    };

    // ===================================================================== 6. gusts on a beam, on a rope =====
    const GP = 6;                                                                      // gust period: +x 0–2 s, calm, −x 3–5 s, calm
    const gustDir = () => { const m = w.t % GP; return m < 2 ? 1 : m >= 3 && m < 5 ? -1 : 0; };
    const gustWarn = () => { const m = w.t % GP; return m >= 5 ? { warn: true, wdir: 1 } : m >= 2 && m < 3 ? { warn: true, wdir: -1 } : { warn: false, wdir: 1 }; };
    const windBeams = (F, y0, a0, n, firstP1 = true) => {
      let s = a0, y = y0;
      F.plat(w, s, s + 4, y, { w: 6, path: true, h: 1.2, color: 0xd9c9a0 });
      const anchors = [{ s0: s, y }];
      for (let i = 1; i <= n; i++) {
        const bs = s + 4, yb = y, yN = y + 1.2;
        w.plat({ tex: 'wood', color: 0xb98a55, x: F.X(0), y: yb, z: F.Z(bs + 3), w: 1.4, d: 6, h: 0.5, path: true });
        F.plat(w, bs + 6, bs + 10, yN, { w: 6, path: true, h: 1.2, color: 0xd9c9a0 });
        anchors.push({ s0: bs + 6, y: yN });
        const SP = plate(w, { x: F.X(1.8), y: yb, z: F.Z(bs - 1.0), need: 'any', size: 1.6, label: 'HOLD THE LINE' });
        const EP = plate(w, { x: F.X(-1.8), y: yN, z: F.Z(bs + 7.0), need: 'any', size: 1.6, label: 'HOLD THE LINE' });
        const winds = [1, -1].map((dx) => w.wind({ x: F.X(0), y: yb + 1.8, z: F.Z(bs + 3), w: 12, h: 4.6, d: 6.2, dx, dz: 0, strength: 26, period: GP, on: 2, phase: dx > 0 ? 0 : GP - 3 }));
        w.updaters.push(() => { const braced = SP.pressed || EP.pressed; for (const wi of winds) wi.strength = braced ? 3 : 26; });
        for (const [ax, as_, ay] of [[2.6, bs - 0.3, yb], [2.6, bs + 6.4, yN]]) pennant(w, F.X(ax), ay, F.Z(as_), () => ({ dir: gustDir(), ...gustWarn() }));
        w.checkpoint({ x: F.X(0), y: yN, z: F.Z(bs + 8), real: true });
        const first = (i % 2 === 1) === firstP1 ? 'p1' : 'p2', second = first === 'p1' ? 'p2' : 'p1';
        const onA = () => feet(yN) && F.S(pl().z) > bs + 6.4;
        const pOnA = partnerUp(F, bs + 6.4, yN);
        add(first,
          { x: F.X(0), z: F.Z(bs - 0.5), r: 0.6, until: () => SP.pressed },
          { follow: true, until: onA },
          { x: F.X(-1.8), z: F.Z(bs + 7.0), r: 0.35, until: pOnA });
        add(second,
          { x: F.X(1.8), z: F.Z(bs - 1.0), r: 0.35, until: pOnA },
          { x: F.X(0), z: F.Z(bs - 0.5), r: 0.6, until: () => EP.pressed },
          { follow: true, until: onA });
        s = bs + 6; y = yN;
      }
      F.plat(w, s + 4, s + 14, y, { path: true, h: 1.2, color: 0xd9c9a0 });
      return { s: s + 14, y, len: 10 };
    };

    // ===================================================================== 7. fragile stones =================
    const fragile = (F, y0, a0, segs, lead0 = 'p1') => {
      const stones = [], ledges = [];
      const tint = new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      const ledge = (s0, yy) => { F.plat(w, s0, s0 + 5, yy, { w: 9, path: true, h: 1.2, color: 0xd9c9a0, trim: COL.good }); ledges.push({ s0, s1: s0 + 5, y: yy }); };
      let s = a0, y = y0;
      ledge(s, y); s += 5;
      for (let k = 0; k < segs; k++) {
        for (let i = 0; i < 3; i++) {
          const s0 = s + 2.0; y += 1;
          const p = w.plat({ tex: 'metal', color: 0x9aa7bd, x: F.X(i % 2 ? 0.9 : -0.9), y, z: F.Z(s0 + 1.1), w: 2.2, d: 2.2, h: 0.7, moving: true, path: true, trim: 0x7fc4ff });
          const ov = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), tint); ov.rotation.x = -Math.PI / 2; ov.position.y = 0.36; p.group.add(ov);
          stones.push({ plat: p, state: 'idle', t: 0, vy: 0 });
          s = s0 + 2.2;
        }
        y += 1; ledge(s + 2.0, y); s += 2.0 + 5;
        w.checkpoint({ x: F.X(0), y, z: F.Z(s - 2.5), real: true });
        w.sign({ text: 'SAFE', x: F.X(0), y: y + 0.03, z: F.Z(s - 1.2), w: 3, h: 0.8, rotX: -Math.PI / 2, color: '#3ddc97', size: 80, tw: 256 });
      }
      sign(w, 'THE STONES ARE FRAGILE. ONE OF YOU AT A TIME. THE GREEN LEDGES ARE SAFE.', F.X(0), y0 + 6.5, F.Z(a0 + 2.5), { w: 11, h: 1.8, size: 30, border: '#3ddc97' });
      const bodies = new Set(stones.map((q) => q.plat.body));
      const mineOn = () => pl().grounded && bodies.has(pl().ground);
      const theirsOn = () => stones.some((q) => q.state === 'idle' && c.partnerOn(q.plat.body));
      let bothT = 0, warned = false;
      const resetAll = () => { for (const q of stones) { q.state = 'idle'; q.t = 0; q.vy = 0; q.plat.setPos(q.plat.base.x, q.plat.base.y, q.plat.base.z); q.plat.body.enabled = true; q.plat.group.visible = true; q.plat.group.scale.setScalar(1); } bothT = 0; };
      w.onRespawn(resetAll);
      w.updaters.push((dt) => {
        const m = mineOn(), t = theirsOn(), bothOn = m && t;
        bothT = bothOn ? bothT + dt : Math.max(0, bothT - dt * 2);
        const pulse = Math.sin(w.t * 18) * 0.5 + 0.5;
        tint.color.setHex(bothOn ? 0xff2d3d : 0xffb030);
        tint.opacity = bothOn ? 0.45 + 0.4 * pulse : (m || t) ? 0.16 : 0;
        if (bothOn && !warned) { warned = true; c.emit('l9stones'); }
        if (bothT > 1.1) {
          for (const q of stones) if (q.state === 'idle' && ((pl().ground === q.plat.body && pl().grounded) || c.partnerOn(q.plat.body))) { q.state = 'fall'; q.t = 0; q.vy = 0; q.plat.body.enabled = false; }
          bothT = 0;
        }
        for (const q of stones) {
          const p = q.plat;
          if (q.state === 'idle') {
            const occ = (pl().ground === p.body && pl().grounded) || c.partnerOn(p.body);
            if (occ && bothOn) p.group.position.set(p.base.x + (Math.random() - 0.5) * 0.08, p.body.y, p.base.z + (Math.random() - 0.5) * 0.08);
          } else if (q.state === 'fall') {
            q.t += dt; q.vy -= 30 * dt; p.group.position.y += q.vy * dt; p.group.scale.setScalar(Math.max(0.01, 1 - q.t * 0.7));
            if (q.t > 1.4) { q.state = 'gone'; q.t = 0; p.group.visible = false; }
          } else if (q.state === 'gone') {
            q.t += dt;
            if (q.t > 3.5) { q.state = 'idle'; p.setPos(p.base.x, p.base.y, p.base.z); p.body.enabled = true; p.group.visible = true; p.group.scale.setScalar(1); }
          }
        }
      });
      w.dbgFrag = { ledges, F, stones };
      const onLedge = (i) => () => feet(ledges[i].y) && F.S(pl().z) > ledges[i].s0 + 0.2 && F.S(pl().z) < ledges[i].s1;
      const partnerOnLedge = (i) => () => P.has && P.g && Math.abs(P.sy - ledges[i].y) < 0.4 && F.S(P.sz) > ledges[i].s0 && F.S(P.sz) < ledges[i].s1;
      const noStone = () => !stones.some((q) => c.partnerOn(q.plat.body));
      for (let k = 0; k < segs; k++) {
        const lead = (k % 2 === 0) === (lead0 === 'p1') ? 'p1' : 'p2', follow = lead === 'p1' ? 'p2' : 'p1';
        const spotL = { x: F.X(-2.5), z: F.Z(ledges[k].s0 + 2.5), r: 0.8 }, spotF = { x: F.X(3.2), z: F.Z(ledges[k].s0 + 2.5), r: 0.8 }, spot2 = { x: F.X(3.2), z: F.Z(ledges[k + 1].s0 + 2.5), r: 0.8 };       // wait on opposite sides of the ledge so nobody blocks the path
        add(lead,
          { ...spotL, until: () => noStone() && (k === 0 || partnerOnLedge(k)()) },
          { follow: true, until: onLedge(k + 1) },
          { ...spot2, until: partnerOnLedge(k + 1) });
        add(follow,
          { ...spotF, until: partnerOnLedge(k + 1) },
          { follow: true, until: onLedge(k + 1) });
      }
      return { s: s, y, len: 5, ledges };
    };

    // ===================================================================== 8. lying signs, fake summit =======
    const stairs = (F, s, y, x, n, o = {}) => {
      const { w: wd = 7, d = 4, gap = 2.2, dy = 1.1, path = true, color = 0xd9c9a0, trim } = o;
      for (let i = 0; i < n; i++) {
        const s0 = s + gap; y += dy;
        F.plat(w, s0, s0 + d, y, { x, w: wd, h: 1, path, color, trim });
        s = s0 + d;
      }
      return { s, y };
    };
    const hubAt = (F, s, y, len = 6, path = true, x = 0, wd = 16) => { F.plat(w, s, s + len, y, { x, w: wd, path, h: 0.8, color: 0xcfb485 }); return { s: s + len, y }; };
    const signs = (F, s, y, textP1, textP2) => {
      roleSign(w, 'p1', textP1, F.X(-4), y + 4.5, F.Z(s), { w: 7, h: 1.6, size: 32 });
      roleSign(w, 'p2', textP2, F.X(4), y + 4.5, F.Z(s), { w: 7, h: 1.6, size: 32 });
    };
    const lies = (F, y0, a0) => {
      let r = stairs(F, a0, y0, 0, 6, { w: 8 });
      sign(w, 'SUMMIT: 40 M.   (IT IS NOT.)', F.X(0), r.y + 4.5, F.Z(r.s - 2), { w: 7, h: 1.2, size: 32 });
      // ---- fork 1: p1's sign tells the truth, p2's does not
      let h1 = hubAt(F, r.s + 2.2, r.y + 1.1);
      w.checkpoint({ x: F.X(0), y: h1.y, z: F.Z(h1.s - 3), real: true });
      signs(F, h1.s - 1, h1.y, `<-- THIS WAY`, `THIS WAY -->`);
      sign(w, 'ONE OF YOUR SIGNS IS LYING. I WON\'T SAY WHOSE.', F.X(0), h1.y + 7.2, F.Z(h1.s - 1), { w: 9, h: 1.1, size: 30, border: '#ff4d5e' });
      const dead1 = stairs(F, h1.s, h1.y, 5, 3, { w: 5, path: false, color: 0xb59470 });
      hubAt(F, dead1.s + 2.2, dead1.y + 1.1, 4, false, 5, 5);
      sign(w, 'THIS WAS NOT THE WAY.', F.X(5), dead1.y + 4.8, F.Z(dead1.s + 4.4), { w: 5, h: 1, size: 34, border: '#ff4d5e' });
      const t1 = stairs(F, h1.s, h1.y, -5, 4, { w: 5 });
      // ---- fork 2: p2's sign tells the truth this time
      let h2 = hubAt(F, t1.s + 2.2, t1.y + 1.1);
      w.checkpoint({ x: F.X(0), y: h2.y, z: F.Z(h2.s - 3), real: true });
      signs(F, h2.s - 1, h2.y, `<-- THIS WAY`, `THIS WAY -->`);
      sign(w, 'THE OTHER ONE IS HONEST NOW. PROBABLY.', F.X(0), h2.y + 7.2, F.Z(h2.s - 1), { w: 9, h: 1.1, size: 30, border: '#ff4d5e' });
      const dead2 = stairs(F, h2.s, h2.y, -5, 4, { w: 5, path: false, color: 0xb59470 });
      hubAt(F, dead2.s + 2.2, dead2.y + 1.1, 4, false, -5, 5);
      sign(w, 'NOPE.', F.X(-5), dead2.y + 4.8, F.Z(dead2.s + 4.4), { w: 4, h: 1, size: 40, border: '#ff4d5e' });
      const t2 = stairs(F, h2.s, h2.y, 5, 5, { w: 5 });
      // ---- fork 3: both signs point at the lit, welcoming, fake summit
      let h3 = hubAt(F, t2.s + 2.2, t2.y + 1.1);
      w.checkpoint({ x: F.X(0), y: h3.y, z: F.Z(h3.s - 3), real: true });
      signs(F, h3.s - 1, h3.y, `<-- SUMMIT`, `<-- SUMMIT`);
      sign(w, 'NOW BOTH OF THEM ARE LYING. IT HAPPENS IN THE BEST OF RELATIONSHIPS.', F.X(0), h3.y + 7.6, F.Z(h3.s - 1), { w: 10, h: 1.3, size: 28, border: '#ff4d5e' });
      // the bright lane is the fake
      const fk = stairs(F, h3.s, h3.y, -5, 2, { w: 5, path: false, color: 0xf0d9a0, trim: 0xffc83d });
      F.plat(w, fk.s + 2.2, fk.s + 12.2, fk.y + 1.1, { x: -5, w: 8, path: false, h: 0.8, color: 0xf0d9a0, trim: 0xffc83d });
      const fy = fk.y + 1.1, fs = fk.s + 7.2;
      for (let q = 0; q < 5; q++) lantern(w, F.X(-5 + (q % 2 ? 3.4 : -3.4)), fy, F.Z(fk.s + 3 + q * 2));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 12, 48), glowMaterial(0x3ddc97, 2));
      ring.position.set(F.X(-5), fy + 1.9, F.Z(fs)); w.add(ring);
      sign(w, 'SUMMIT', F.X(-5), fy + 4.6, F.Z(fs), { w: 5, h: 1.2, border: '#3ddc97' });
      beacon(w, F.X(-5), fy, F.Z(fs), 0xffe9a8, 26);
      w.checkpoint({ x: F.X(-5), y: fy, z: F.Z(fs - 3), real: false, label: 'CHECKPOINT' });
      const fz = c.zone({ x: F.X(-5), y: fy + 1.9, z: F.Z(fs), w: 3.4, h: 3.6, d: 3.4, need: 'both', shrink: 0 });
      let fdone = false;
      fz.onChange((z) => { if (z.active && !fdone) { fdone = true; tell('all', 'coop.l9.fakesummit'); ring.visible = false; } });
      stage(w, 'fakeon', { x: F.X(-5), y: fy + 2, z: F.Z(fs), w: 8, h: 5, d: 8 }, () => tell('all', 'coop.l9.fakeview'));
      // the dark, narrow, unlit lane is the real one
      const real = stairs(F, h3.s, h3.y, 5, 4, { w: 4 });
      F.plat(w, real.s + 2.2, real.s + 12.2, real.y + 1.1, { x: 4, w: 8, path: true, h: 0.8, color: 0xd9c9a0 });
      w.checkpoint({ x: F.X(0), y: real.y + 1.1, z: F.Z(real.s + 6), real: true });
      return { s: real.s + 12.2, y: real.y + 1.1, len: 10 };
    };

    // ===================================================================== assemble ===========================
    let F = frame({ x: 0, z: 0, y: 0, dz: 1, skip: 0 });
    w.spawn = { x: F.X(me === 'p1' ? -1.8 : 1.8), y: 0, z: F.Z(-3), yaw: 0 };
    w.respawn = { ...w.spawn };
    sign(w, 'SERENITY FALLS · LEFT LUGGAGE', F.X(0), 6.2, F.Z(-6), { w: 12, h: 1.6 });
    sign(w, 'SESSION 9: SHARED BAGGAGE', F.X(0), 4.4, F.Z(-6), { w: 8, h: 1, border: '#39d7c9' });
    for (const lx of [-9, 9]) lantern(w, F.X(lx), 0, F.Z(-5));
    stage(w, 'welcome', { x: F.X(0), y: 1, z: F.Z(-2), w: 18, h: 4, d: 8 }, () => { tell('p1', 'coop.l9.intro.p1', { priority: 2 }); tell('p2', 'coop.l9.intro.p2', { priority: 2 }); });
    const Y = [0];                                                             // stage start heights (for the kill plane)
    const decorate = (F0, s0, s1, y0, y1, count) => luggageStacks(w, F0, { s0, s1, y0, y1, count });
    const tagAt = (F0, text, s, yy) => { const sd = F0.x === 0 ? -1 : 1; crateTag(w, text, F0.X(sd * 8.7), yy, F0.Z(s), sd > 0 ? -Math.PI / 2 : Math.PI / 2); };
    /** bots: walk the path until standing on the first deck of the next piece */
    const approach = (F0, yy) => both({ follow: true, until: () => feet(yy, 1.6) && F0.S(pl().z) > F0.skip + 2 && Math.abs(pl().x - F0.X(0)) < 9 });       // (some stages start straight on a stair 1.1 m up)
    /** close a stage: wide transfer deck to the next lane, then the next frame */
    const finish = (F0, r) => {
      const len = F0.transfer(w, r.s, r.y);
      mark(r.y);                                                                      // a respawn up here replays the crossing to the next lane
      const cx = F0.X(0), cz = F0.Z(r.s + len / 2);
      both({ follow: true, until: () => Math.hypot(pl().x - cx, pl().z - cz) < 14 && Math.abs(pl().y - r.y) < 1.2 },    // far away (e.g. after a respawn)? follow the route until we are on the transfer deck
        { x: cx, z: cz, r: 1.5 }, { x: F0.nextX, z: cz, r: 1.5 });                        // bots: cross the transfer deck to the next lane (not along its edge)
      return nextFrame(F0, r.s + len, r.y, len);
    };

    // ---- 1
    mark(0);
    const r1 = headWalls(F, 0, -8, 22, 2);
    beat(F, 8, 0, () => tell('all', 'coop.l9.wall'));
    beat(F, 22, 3, () => tell('all', 'coop.l9.wall2'));
    decorate(F, -10, 50, 0, 8, 26); tagAt(F, 'DAD ISSUES', 10, 8); tagAt(F, 'HER MOTHER', 30, 10);
    F = finish(F, r1);
    // ---- 2
    const y2 = r1.y;
    beat(F, F.skip, y2, () => { tell('all', 'coop.l9.pulley'); raiseKill(-3); });
    beat(F, F.skip + 20, y2 + 6, () => tell('all', 'coop.l9.pulley2'));
    mark(y2);
    approach(F, y2);
    const r2 = pulleys(F, y2, F.skip, 2);
    decorate(F, 0, r2.s + 12, y2, r2.y, 30); tagAt(F, 'LAST SUMMER', 20, y2 + 6); tagAt(F, 'UNRESOLVED', 40, y2 + 12);
    cloudBank(w, 14, { cz: -20 });
    F = finish(F, r2);
    // ---- 3
    const y3 = r2.y;
    beat(F, F.skip, y3, () => { tell('all', 'coop.l9.pend'); raiseKill(y2 - 3); });
    mark(y3);
    const F3 = F;                                                                  // (F is reassigned further down; closures must keep this stage's frame)
    both({ follow: true, until: () => feet(y3) && Math.abs(pl().x - F3.X(0)) < 22 });         // onto the transfer deck, then the ladder() waypoint lines up with the first ledge
    const r3 = ladder(F, y3, F.skip, 4);
    beat(F, F.skip + 3, r3.ledges[2].y, () => tell('all', 'coop.l9.pend2'));
    decorate(F, 0, r3.s + 12, y3, r3.y, 22); tagAt(F, 'HIS EX', 14, y3 + 3);
    F = finish(F, r3);
    // ---- 4
    const y4 = r3.y;
    beat(F, F.skip, y4, () => { tell('all', 'coop.l9.belt'); raiseKill(y3 - 3); });
    mark(y4);
    approach(F, y4);
    const r4 = belts(F, y4, F.skip, 4, true);
    decorate(F, 0, r4.s + 12, y4, r4.y, 22); tagAt(F, 'BAGGAGE CLAIM', 18, y4 + 6);
    cloudBank(w, 36, { cz: -40 });
    F = finish(F, r4);
    // ---- 5
    const y5 = r4.y;
    beat(F, F.skip, y5, () => { tell('all', 'coop.l9.elev'); raiseKill(y4 - 3); });
    mark(y5);
    approach(F, y5);
    const r5 = elevators(F, y5, F.skip, 2, 12, 'p1');
    beat(F, F.skip + 20, y5 + 12, () => tell('all', 'coop.l9.elev2'));
    decorate(F, 0, r5.s + 12, y5, r5.y, 30); tagAt(F, 'THE THING YOU SAID', 22, y5 + 14);
    cloudBank(w, 52, { cz: -40 });
    F = finish(F, r5);
    // ---- 6
    const y6 = r5.y;
    beat(F, F.skip, y6, () => { tell('all', 'coop.l9.wind'); raiseKill(y5 - 3); c.tether({ max: 13, k: 12, rope: true, on: true }); });
    mark(y6);
    approach(F, y6);
    const r6 = windBeams(F, y6, F.skip, 4, true);
    stage(w, 'unrope', { x: F.X(0), y: r6.y + 2.5, z: F.Z(r6.s - 5), w: 14, h: 6, d: 6 }, () => { c.tether({ on: false }); tell('all', 'coop.l9.unrope'); });
    decorate(F, 0, r6.s + 12, y6, r6.y, 20); tagAt(F, 'COMMUNICATION (EMPTY)', 14, y6 + 4);
    F = finish(F, r6);
    // ---- 7
    const y7 = r6.y;
    beat(F, F.skip, y7, () => { tell('all', 'coop.l9.stones'); raiseKill(y6 - 3); });
    let toldBoth = false;
    c.onEvent('l9stones', () => { if (toldBoth) return; toldBoth = true; tell('all', 'coop.l9.stonesboth'); });
    mark(y7);
    approach(F, y7);
    const r7 = fragile(F, y7, F.skip, 3, 'p1');
    decorate(F, 0, r7.s + 12, y7, r7.y, 28); tagAt(F, 'FRAGILE', 20, y7 + 6);
    cloudBank(w, 70, { cz: -30 });
    F = finish(F, r7);
    // ---- 8
    const y8 = r7.y;
    beat(F, F.skip, y8, () => { tell('all', 'coop.l9.signs'); raiseKill(y7 - 3); });
    mark(y8);
    approach(F, y8);
    const r8 = lies(F, y8, F.skip);
    decorate(F, 0, r8.s + 12, y8, r8.y, 34); tagAt(F, 'WELL-INTENTIONED ADVICE', 24, y8 + 10);
    cloudBank(w, 92, { cz: -30 });
    F = finish(F, r8);
    // ---- 9: a recap, fast
    w.dbgF9 = F;
    const y9 = r8.y; w.dbgY9 = y9;
    beat(F, F.skip, y9, () => { tell('all', 'coop.l9.recap'); raiseKill(y8 - 3); });
    mark(y9);
    approach(F, y9);
    const L9 = { a: [bots.p1.length, bots.p2.length] };
    const a9 = headWalls(F, y9, F.skip, 14, 1);
    L9.b = [bots.p1.length, bots.p2.length]; w.dbgL9 = L9;
    decorate(F, 0, a9.s + 12, y9, a9.y, 12);
    F = finish(F, a9);
    approach(F, a9.y);
    const b9 = pulleys(F, a9.y, F.skip, 1);
    decorate(F, 0, b9.s + 12, a9.y, b9.y, 12);
    F = finish(F, b9);
    beat(F, F.skip, b9.y, () => tell('all', 'coop.l9.recap2'));
    approach(F, b9.y);
    const c9 = elevators(F, b9.y, F.skip, 1, 10, 'p2');
    decorate(F, 0, c9.s + 12, b9.y, c9.y, 14);
    cloudBank(w, 105, { cz: -30 });
    F = finish(F, c9);
    approach(F, c9.y);
    const d9 = belts(F, c9.y, F.skip, 1, false);
    F = finish(F, d9);
    approach(F, d9.y);
    const e9 = fragile(F, d9.y, F.skip, 1, 'p2');
    decorate(F, 0, e9.s + 12, d9.y, e9.y, 12);
    F = finish(F, e9);
    // the real summit
    beat(F, F.skip, e9.y, () => tell('all', 'coop.l9.top'));
    const gy = e9.y, topS = F.skip + 12;
    F.plat(w, F.skip, F.skip + 20, gy, { path: true, h: 0.8, color: 0xe9d9b0, trim: COL.good });
    const gz = F.Z(F.skip + 12);
    w.goal({ x: F.X(0), y: gy, z: gz });
    beacon(w, F.X(0), gy, gz, 0xffe9a8, 30);
    sign(w, 'BOTH OF YOU. IN THE CIRCLE. YOU KNOW THE ONE.', F.X(0), gy + 5.2, F.Z(topS + 5), { w: 10, h: 1.6 });
    for (const lx of [-5, 5]) lantern(w, F.X(lx), gy, F.Z(F.skip + 4));
    stage(w, 'circle', { x: F.X(0), y: gy + 1, z: F.Z(F.skip + 4), w: 14, h: 4, d: 6 }, () => tell('all', 'coop.l9.circle'));
    w.checkpoint({ x: F.X(0), y: gy, z: F.Z(F.skip + 3), real: true });
    cloudBank(w, 118, { cz: -30 });

    w.hooks.onPartnerDeath = () => { tell('all', 'coop.l9.partnerdown'); return true; };

    // ===================================================================== bots =================================
    closeCps();
    botSteps(w, { p1: [...bots.p1, { follow: true }], p2: [...bots.p2, { follow: true }] });
  },
};
