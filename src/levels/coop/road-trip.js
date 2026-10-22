import * as THREE from 'three';
import { glowMaterial, plainMaterial } from '../../engine/materials.js';
import { retreatEnv, deck, stone, plate, gate, sign, lantern, lake, stage, beacon, COL } from './kit.js';
import { LANE_X, laneX, CAR, ROAD_W, LETHAL, cycle, roadMarks, cones, arm, crossing, lowBridge, block, mapBoard, dashboard, stud } from './road-trip-kit.js';

// Session 12 — Road Trip. A scenic highway, one big shared car. Whoever drives stands on the pedals (left / centre / right lane, and a brake)
// but a dashboard hides the road; whoever navigates sees the road and a sat-nav map and has to shout. The car is a moving platform: its
// position is integrated from the shared lane / brake state on both machines (resets to the last stop when either of you dies).
// Stages: lanes + crossing, toll plaza (pay on the kerb, stop the car, time the arms), two forks where the sat-nav lies, roadworks (hop onto the
// trailer under the low bridges), rest stop (swap seats), the dark tunnel (navigator's headlight), the van chase. Dawn.

export default {
  id: 'coop12',
  name: 'Road Trip',
  music: 'l1',
  deathRule: 'self',
  completeQuip: 'Eleven hundred metres. Nobody got out and walked. I had money on it.',
  titleCam: { center: [0, 3, -40], radius: 30, height: 12 },

  build(w, game) {
    retreatEnv(w, { mood: 'dawn' });
    lake(w, -30);
    const c = w.coop, me = c.me, N = c.names, P = c.partner, pl = game.player;
    w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.stepHeight = 0.3;                                  // the trailer deck is a 0.2 m lip: walk onto it
    const tell = (r, k, o) => c.tell(r, k, o);
    const other = (r) => (r === 'p1' ? 'p2' : 'p1');

    // ------------------------------------------------------------------------------------------------------------
    //  layout constants
    // ------------------------------------------------------------------------------------------------------------
    const TUN = [                                      // tunnel floating road pieces: gap before it, depth, width, x, dy
      [2.6, 5, 6, 0, 0], [3.0, 4.6, 4.8, -2.4, 0], [3.0, 5, 5, 2.2, 0.4], [2.8, 4.6, 4.6, -1.8, 0.4], [3.0, 5, 5.2, 2.6, 0], [3.0, 5, 4.8, 0.2, 0],
      [2.8, 4.6, 4.6, -2.6, -0.4], [3.0, 5, 5, 1.6, -0.4], [3.0, 5, 4.8, -1.4, 0], [2.8, 4.6, 4.6, 2.4, 0], [3.0, 5, 5, 0.4, 0.4], [2.8, 5, 4.8, -2.2, 0.4], [3.0, 5.2, 6, 0, 0],
    ];
    const Z_B4 = -730, Z_TUN0 = Z_B4 - 12;
    let cur = Z_TUN0;
    const tunnelPieces = TUN.map(([gap, d, ww, x, dy]) => { cur -= gap; const z = cur - d / 2; cur -= d; return { x, z, d, w: ww, y: dy }; });
    const Z_TUN1 = cur - 2.6;                          // tunnel exit (= start of the exit bay)
    const Z_B6 = Z_TUN1 - 12;                          // exit bay centre, the chase starts here
    const Z_CH1 = Z_B6 - 12 - 200;                     // end of the chase road
    const Z_B7 = Z_CH1 - 12;                           // finish bay centre
    const SEC = [
      { id: 'lanes', z0: -6, z1: -190, v: 4.4 },
      { id: 'toll', z0: -190, z1: -364, v: 4.2 },
      { id: 'fork', z0: -364, z1: -540, v: 4.4 },
      { id: 'works', z0: -540, z1: Z_B4, v: 2.6, trailer: true },
      { id: 'chase', z0: Z_B6, z1: Z_B7 + 4, v: 4.8 },
    ];
    const PAY = { x: 12.6, z: -254 };
    const TR_OFF = 6.6;                                // trailer centre behind the car centre
    const BRIDGES = [-588, -636, -684];
    const CH_V = 3.4;                                  // the van's speed

    // ------------------------------------------------------------------------------------------------------------
    //  shared state: the car
    // ------------------------------------------------------------------------------------------------------------
    const R = { z: SEC[0].z0, x: 0, v: 0, mode: 'parked', sec: 0, lane: 0, brake: false, driver: 'p1', paid: false, payT: -1e9, swapped: false,
      chOn: false, chZ: 0, gap: 99, noSignal: false, trailerOn: false };
    const items = [];
    const dbgStart = +(new URLSearchParams(location.search).get('rt') || 0);           // ?rt=N starts at section N (testing only)
    if (dbgStart > 0 && dbgStart <= 4) {
      R.sec = dbgStart; R.z = SEC[dbgStart].z0; if (dbgStart === 4) { R.z = Z_B4; R.swapped = false; }
      const z0 = dbgStart === 4 ? Z_B4 : SEC[dbgStart].z0;
      w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: z0 + 10, yaw: 0 }; w.respawn = { ...w.spawn };
    }
    c.on('lane', (v) => { R.lane = v; });
    c.on('brake', (v) => { R.brake = !!v; });
    c.on('driver', (v) => { R.driver = v; applyViews(); });
    const told = new Set();
    const once = (k, role = 'all', o) => { if (told.has(k + role)) return; told.add(k + role); tell(role, k, o); };

    // ------------------------------------------------------------------------------------------------------------
    //  the world: bays and roads
    // ------------------------------------------------------------------------------------------------------------
    const asphalt = 0x4a4f5c;
    const D = (x0, x1, zA, zB, o = {}) => stone(w, { x: (x0 + x1) / 2, y: 0, z: (zA + zB) / 2, w: x1 - x0, d: Math.abs(zB - zA), color: asphalt, ...o });
    const bay = (zc, name, o = {}) => {
      deck(w, { x: 0, y: 0, z: zc, w: 30, d: 24, ...o });
      for (const lx of [-14, 14]) { lantern(w, lx, 0, zc + 8); lantern(w, lx, 0, zc - 8); }
      if (o.cp !== false) {
        w.checkpoint({ x: -10.5, y: 0, z: zc, real: true, label: name });
        const tr = w.triggers[w.triggers.length - 1];                        // the whole bay counts: the car rolls in with you on it
        tr.body.hx = 14; tr.body.hz = 5; tr.body.setCenter(0, 1.2, zc);
      }
    };
    bay(-4, 'START', { cp: false });
    sign(w, 'SESSION 12 · ROAD TRIP', 0, 10.8, -16, { w: 14, h: 1.9 });
    sign(w, 'CLIMB ON THE CAR · BOTH OF YOU', 0, 6.4, -13, { w: 10, h: 1.3 });
    D(-13, 13, -16, -178); roadMarks(w, -16, -178);
    bay(-190, 'STOP 1');
    D(-13, 13, -202, -352); roadMarks(w, -202, -352);
    bay(-364, 'STOP 2');
    // the fork road (two forks; each one has a dead branch that is closed off)
    D(-13, 13, -376, -424); roadMarks(w, -376, -424);
    D(3.2, 13, -424, -462); D(-3.2, 3.2, -424, -462); D(-13, -3.2, -424, -438);
    D(-13, 13, -462, -492); roadMarks(w, -462, -492);
    D(-13, -3.2, -492, -524); D(-3.2, 3.2, -492, -524); D(3.2, 13, -492, -500);
    D(-13, 13, -524, -528);
    bay(-540, 'STOP 3');
    D(-13, 13, -552, Z_B4 + 12); roadMarks(w, -552, Z_B4 + 12);
    bay(Z_B4, 'REST STOP');
    // chase road after the tunnel
    bay(Z_B6, 'STOP 4');
    D(-13, 13, Z_B6 - 12, Z_CH1); roadMarks(w, Z_B6 - 12, Z_CH1);
    bay(Z_B7, 'THE END', { cp: true });

    // invisible lethal floor far below the route so a fall is a short one
    const slab = w.hazard({ x: 0, y: -10, z: (20 + Z_B7 - 20) / 2, w: 160, h: 2, d: Math.abs(Z_B7) + 80 });
    slab.group.visible = false;

    // ------------------------------------------------------------------------------------------------------------
    //  the car
    // ------------------------------------------------------------------------------------------------------------
    const carPlat = w.plat({ x: 0, y: CAR.h, z: R.z, w: CAR.w, d: CAR.d, h: CAR.h, tex: 'metal', color: 0xd0443a, trim: 0xffc83d, moving: true, path: false });
    const cg = carPlat.group;
    const mount = (mesh, lx, ly, lz) => { if (mesh.parent) mesh.parent.remove(mesh); cg.add(mesh); mesh.position.set(lx, ly, lz); mesh.matrixAutoUpdate = true; return mesh; };
    for (const sx of [-1, 1]) for (const sz of [-2.1, 2.1]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.5, 18), plainMaterial(0x1a1c22, { roughness: 0.8 }));
      wh.rotation.z = Math.PI / 2; mount(wh, sx * 2.45, -0.1, sz);
    }
    for (const sx of [-1.8, 1.8]) {
      mount(new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), glowMaterial(0xfff1c0, 2.4)), sx, 0.2, -3.28);
      mount(new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), glowMaterial(0xff3040, 2.0)), sx, 0.2, 3.28);
    }
    // pedals (car-local x, z). Stand on one: only the DRIVER's feet count.
    const PED_Y = 0.5 + 0.06;
    const pedMats = [];
    const pedal = (lx, lz, pw, pd, color, label) => {
      const m = glowMaterial(color, 0.8);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.12, pd), m); mount(pad, lx, PED_Y, lz);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.2, 0.08, pd + 0.2), plainMaterial(0x14161e)); mount(frame, lx, 0.5 + 0.03, lz);
      const t = w.sign({ text: label, x: 0, y: 0, z: 0, w: pw - 0.1, h: Math.min(pd - 0.15, 0.6), rotX: -Math.PI / 2, tw: 256, bg: 'rgba(10,12,18,0.0)', color: '#10131c', size: 44, double: false });
      mount(t, lx, PED_Y + 0.075, lz);
      pedMats.push({ m, color, base: 0.8 });
      return m;
    };
    const PEDS = [{ lane: -1, lx: -1.75 }, { lane: 0, lx: 0 }, { lane: 1, lx: 1.75 }];
    const lanePedMat = PEDS.map((pd) => pedal(pd.lx, -2.3, 1.1, 1.2, 0x39d7c9, ['LEFT', 'CENTRE', 'RIGHT'][pd.lane + 1]));
    const brakeMat = pedal(0, -0.7, 2.8, 1.0, 0xff5a68, 'BRAKE');
    const zoneAt = (lx, lz, pw, pd) => {
      const z = c.zone({ x: R.x + lx, y: 2.3, z: R.z + lz, w: pw - 0.1, h: 2.6, d: pd - 0.1, need: 'any', shrink: 0.2 });
      z.lx = lx; z.lz = lz; return z;
    };
    const lz = PEDS.map((pd) => zoneAt(pd.lx, -2.3, 1.1, 1.2));
    const bz = zoneAt(0, -0.7, 2.8, 1.0);
    const aboard = c.zone({ x: 0, y: 2.6, z: R.z, w: CAR.w - 0.2, h: 3.2, d: CAR.d - 0.2, need: 'both', shrink: 0 });
        const goSign = w.sign({ text: 'BOTH ABOARD · THEN WE GO', x: 0, y: 0, z: 0, w: 3.6, h: 0.6, rotX: -Math.PI / 2, tw: 512, bg: 'rgba(20,16,12,0.0)', color: '#fff3d0', size: 42, double: false });
    mount(goSign, 0, PED_Y + 0.02, 2.3);
    // trailer (roadworks only)
    const trailer = w.plat({ x: 0, y: 0.2, z: R.z + TR_OFF, w: CAR.w, d: 4, h: 0.2, tex: 'metal', color: 0x9aa3b8, trim: 0xffc83d, moving: true });
    trailer.setEnabled(false);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.5), plainMaterial(0x2b2f3a));
    mount(bar, 0, 0.0, 4.0);
    // dashboard (driver) and map (navigator): both ride on the car
    const dash = dashboard(w, R, me, { width: 20, height: 2.8 });
    mount(dash.mesh, 0, 1.85, -6.4);
    const map = mapBoard(w, R, items, { width: 4.4, height: 2.75 });
    mount(map.mesh, 0, 3.85, -3.1);
    function applyViews() {
      dash.mesh.visible = R.driver === me; map.mesh.visible = R.driver !== me;
      if (R.driver === me) dash.draw(true); else map.draw();
      const col = R.driver === 'p1' ? COL.p1 : COL.p2;
      pedMats.forEach((p) => { p.color = p.m === brakeMat ? 0xff5a68 : col; });
    }
    applyViews();

    const onCar = (q) => Math.abs(q.x - R.x) < 2.7 && Math.abs(q.z - R.z) < 3.7 && q.y > 0.7 && q.y < 2.4;
    const partnerPos = () => ({ x: P.sx, y: P.sy, z: P.sz });

    // ---- section control ----------------------------------------------------------------------------------
    const go = () => {
      const S = SEC[R.sec];
      R.mode = 'drive';
      if (R.sec === 4) { R.chOn = true; R.chZ = R.z + 38; R.gap = R.chZ - 5.5 - R.z; }
      void S;
    };
    const reset = () => {
      if (R.mode !== 'drive') return;
      const S = SEC[R.sec]; if (!S) return;
      R.mode = 'parked'; R.z = S.z0; R.x = 0; R.v = 0; R.lane = 0; R.brake = false; R.chOn = false;
      if (R.sec === 1) { R.paid = false; R.payT = -1e9; }
      once('coop.l12.reset', 'all');
    };
    const arrive = () => {
      const S = SEC[R.sec];
      R.z = S.z1; R.v = 0; R.mode = 'parked'; R.chOn = false; R.sec++;
      if (R.sec === 4) once('coop.l12.works.done', 'all');
    };
    // the host is the authority for where the car is: it broadcasts its state ten times a second, the guest eases onto it
    let sync = null, sendT = 0;
    c.onEvent('rt:car', (m) => {
      if (c.isHost) return;
      if (m.sec !== R.sec || m.mode !== R.mode) {
        Object.assign(R, { sec: m.sec, mode: m.mode, z: m.z, x: m.x, v: m.v, chOn: m.chOn, chZ: m.chZ, paid: m.paid, payT: m.payT });
        sync = null;
      } else if (m.mode === 'parked') { R.z = m.z; sync = null; }
      else sync = { ...m, at: performance.now() };
    });
    c.onEvent('rt:reloc', () => { if (R.sec === 4 && R.mode === 'parked') { R.z = SEC[4].z0; R.x = 0; R.lane = 0; R.brake = false; } });
    c.onEvent('rt:go', (s) => { if (R.mode === 'parked' && R.sec === s) go(); });
    c.onEvent('rt:reset', () => reset());
    w.hooks.onDeath = () => { c.emit('rt:reset', 1); return false; };
    c.onEvent('rt:pay', (t) => { if (R.paid) return; R.paid = true; R.payT = t; once('coop.l12.paid', 'all'); });

    let dwell = 0;
    w.updaters.push((dt) => {
      const S = SEC[R.sec];
      // lateral
      const dx = laneX(R.lane) - R.x;
      R.x += Math.sign(dx) * Math.min(Math.abs(dx), 5.0 * dt);
      // longitudinal
      if (R.mode === 'drive' && S) {
        const tgt = R.brake ? 0 : S.v * Math.max(0.15, Math.min(1, (R.z - S.z1) / 9));
        R.v += Math.sign(tgt - R.v) * Math.min(Math.abs(tgt - R.v), (tgt > R.v ? 3.5 : 7) * dt);
        R.z -= R.v * dt;
        if (R.z <= S.z1 + 0.02) arrive();
      } else R.v = 0;
      if (c.isHost) { sendT += dt; if (sendT > 0.1) { sendT = 0; c.emit('rt:car', { z: R.z, x: R.x, v: R.v, mode: R.mode, sec: R.sec, chOn: R.chOn, chZ: R.chZ, paid: R.paid, payT: R.payT }); } }
      else if (sync && R.mode === 'drive') {
        const age = (performance.now() - sync.at) / 1000 + c.rtt / 2, k = Math.min(1, 6 * dt);
        R.z += (sync.z - sync.v * age - R.z) * k;
        if (R.chOn) R.chZ += (sync.chZ - CH_V * age - R.chZ) * k;
      }
      R.trailerOn = R.sec === 3;
      if (trailer.body.enabled !== R.trailerOn) { trailer.setEnabled(R.trailerOn); }
      bar.visible = R.trailerOn;
      carPlat.setPos(R.x, 0.5, R.z);
      if (R.trailerOn) trailer.setPos(R.x, 0.1, R.z + TR_OFF);
      for (const z of lz) z.body.setCenter(R.x + z.lx, 2.3, R.z + z.lz);
      bz.body.setCenter(R.x + bz.lx, 2.3, R.z + bz.lz);
      aboard.body.setCenter(R.x, 2.6, R.z);
      // pedals light up
      const drvCol = R.driver === 'p1' ? COL.p1 : COL.p2;
      PEDS.forEach((pd, i) => { const on = R.lane === pd.lane; lanePedMat[i].color.setHex(drvCol).multiplyScalar(on ? 1.5 : 0.5); });
      brakeMat.color.setHex(0xff5a68).multiplyScalar(R.brake ? 1.7 : 0.6);
      if (R.driver === me && game.state === 'playing') {                 // the driver's feet are the controls
        const k = lz.findIndex((z) => z.mine);
        if (k >= 0 && R.lane !== PEDS[k].lane) c.set('lane', PEDS[k].lane);
        if (R.brake !== bz.mine) c.set('brake', bz.mine);
      }
      // depart when both are aboard
      if (R.mode === 'parked' && S && Math.abs(R.z - S.z0) < 2 && aboard.active) { dwell += dt; if (dwell > 2.2) { dwell = 0; c.emit('rt:go', R.sec); } } else dwell = 0;
      goSign.visible = R.mode === 'parked' && !!S && Math.abs(R.z - S.z0) < 2;
      // the van behind (chase)
      if (R.chOn && R.mode === 'drive') {
        R.chZ -= CH_V * dt;
        R.gap = R.chZ - 2.25 - R.z - 3.25;
        if (R.gap < -0.2 && game.state === 'playing' && Math.hypot(pl.x - R.x, pl.z - R.z) < 9) game.kill('hazard');
      }
      R.noSignal = (R.z < -476 && R.z > -532 && R.sec === 2);
      dash.mesh.visible && dash.draw(false);
      map.tick(dt);
    });
    // map hides on the driver's machine, dashboard on the navigator's: applyViews() sets that; also hide the pedal hint for the navigator
    // (nothing else needs hiding)

    // the van
    const van = new THREE.Group(); w.add(van);
    {
      const body = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.8, 4.5), plainMaterial(0xeceff4, { roughness: 0.5 })); body.position.y = 1.9; van.add(body);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.45, 0.5, 4.55), plainMaterial(0x3b6fd8)); stripe.position.y = 1.5; van.add(stripe);
      const wsh = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.0, 0.1), glowMaterial(0x203050, 0.9)); wsh.position.set(0, 2.4, 2.28); van.add(wsh);
      var vanLamps = [-1.9, 1.9].map((sx) => { const m = glowMaterial(0xffb020, 2.4); const l = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 12), m); l.position.set(sx, 1.1, 2.3); van.add(l); return m; });
      const vs = w.sign({ text: 'COUNSELLING', x: 0, y: 0, z: 0, w: 4.2, h: 0.8, tw: 512, glow: true, color: '#10131c', bg: '#f2c14e', border: '#10131c', size: 56 });
      if (vs.parent) vs.parent.remove(vs); van.add(vs); vs.position.set(0, 2.9, -2.3); vs.rotation.y = Math.PI;
    }
    van.visible = false;
    w.updaters.push(() => {
      van.visible = R.chOn;
      if (!R.chOn) return;
      van.position.set(R.x, 0, R.chZ);
      const on = R.gap < 26 && Math.sin(w.t * 12) > 0;
      for (const m of vanLamps) m.color.setHex(0xffb020).multiplyScalar(on ? 2.6 : 0.3);
    });

    // ------------------------------------------------------------------------------------------------------------
    //  section 1: lanes, cones, a level crossing
    // ------------------------------------------------------------------------------------------------------------
    cones(w, R, items, [0], -44);
    cones(w, R, items, [-1, 0], -70);
    cones(w, R, items, [0, 1], -94);
    cones(w, R, items, [-1, 1], -118);
    crossing(w, R, items, -146, { period: 12, open: 8, offset: 3, rampDown: 1.5 });
    cones(w, R, items, [0, 1], -170);
    stage(w, 'welcome', { x: 0, y: 2, z: 3, w: 30, h: 6, d: 8 }, () => {
      tell(R.driver, 'coop.l12.intro.driver', { priority: 2 });
      tell(other(R.driver), 'coop.l12.intro.nav', { priority: 2 });
    });
    const at = (name, z, fn, wd = 4) => stage(w, name, { x: 0, y: 2.5, z, w: 30, h: 8, d: wd }, fn);
    at('lanes', -20, () => { tell(R.driver, 'coop.l12.lanes.driver'); tell(other(R.driver), 'coop.l12.lanes.nav'); });
    at('cones', -34, () => tell('all', 'coop.l12.cones'));
    at('crossing', -126, () => tell('all', 'coop.l12.crossing'));
    at('s1done', -184, () => tell('all', 'coop.l12.s1done'));

    // ------------------------------------------------------------------------------------------------------------
    //  section 2: the toll plaza
    // ------------------------------------------------------------------------------------------------------------
    cones(w, R, items, [-1, 0], -226);
    {
      const kz0 = -246, kz1 = -270;
      w.plat({ x: 13, y: 1.0, z: (kz0 + kz1) / 2, w: 4.8, d: Math.abs(kz1 - kz0), h: 1.0, tex: 'wood', color: 0x9aa3b8, trim: COL.good });
      items.push({ kind: 'kerb', x: 13, z: (kz0 + kz1) / 2, hw: 2.4, hd: 12, label: 'PAY' });
      const booth = w.box({ x: 14.6, y: 2.9, z: -262, w: 2.4, h: 3.8, d: 4, color: 0xf2eadc, tex: 'wood', shadow: true });
      void booth;
      sign(w, 'TOLL BOOTH · PAY ON THE PAD', 12.2, 5.6, -250, { w: 7, h: 1.3, size: 40, border: '#3ddc97' });
      plate(w, { x: PAY.x, y: 1.0, z: PAY.z, size: 2.4, need: 'any', label: 'PAY' }, (on) => { if (on && !R.paid && game.state === 'playing') c.emit('rt:pay', w.t); });
      const rowA = (z, offs) => [-1, 0, 1].forEach((l, i) => arm(w, R, items, { x: laneX(l), z, width: 6.4, side: 1, a: (t) => (R.paid ? cycle(t - R.payT, { period: 9, open: 5.2, offset: offs[i], rampDown: 1.4 }) : 0), label: R.paid ? null : 'LOCKED' }));
      rowA(-294, [0, 3, 6]);
      rowA(-322, [6, 0, 3]);
      sign(w, 'TOLL · ALL LANES LOCKED UNTIL SOMEONE PAYS', 0, 6.2, -288, { w: 12, h: 1.5, size: 38, border: '#ff4d5e' });
      sign(w, 'GREEN GO · AMBER NO · RED YOU WILL BE FINE (NOT FINE)', 0, 6.2, -316, { w: 12, h: 1.5, size: 34, border: '#ffc83d' });
    }
    cones(w, R, items, [-1, 1], -344);
    at('toll', -206, () => { tell(R.driver, 'coop.l12.toll.driver'); tell(other(R.driver), 'coop.l12.toll.nav'); });
    at('toll2', -282, () => tell('all', 'coop.l12.toll2'));
    at('s2done', -358, () => tell('all', 'coop.l12.s2done'));

    // ------------------------------------------------------------------------------------------------------------
    //  section 3: two forks, the sat-nav lies
    // ------------------------------------------------------------------------------------------------------------
    cones(w, R, items, [-1], -390);
    cones(w, R, items, [0], -404);
    block(w, R, items, { x: 0, z: -443, width: 6.4, depth: 38, h: 3.0, color: 0x6a7488, flash: false, label: '' });
    block(w, R, items, { x: -8.1, z: -436, width: 9.6, depth: 1.2, label: 'BRIDGE OUT', sign: 'BRIDGE OUT' });
    block(w, R, items, { x: 0, z: -508, width: 6.4, depth: 32, h: 3.0, color: 0x6a7488, flash: false, label: '' });
    block(w, R, items, { x: 8.1, z: -498, width: 9.6, depth: 1.2, label: 'CLOSED', sign: 'ROAD CLOSED' });
    sign(w, '← LAKE VIEW  (BRIDGE WORKS)        TOWN  →', 0, 7.2, -412, { w: 16, h: 2.2, size: 46, border: '#9fe8ff' });
    sign(w, '← SERENITY FALLS        ROAD CLOSED  →', 0, 7.2, -480, { w: 16, h: 2.2, size: 48, border: '#ff4d5e' });
    at('fork1', -392, () => { once('coop.l12.fork1', 'all'); });
    at('fork1b', -412, () => { tell(other(R.driver), 'coop.l12.fork1.nav'); });
    at('fork1done', -468, () => { tell('all', 'coop.l12.fork1done'); });
    at('fork2', -482, () => { once('coop.l12.fork2', 'all'); }, 3);
    at('s3done', -534, () => tell('all', 'coop.l12.s3done'));

    // ------------------------------------------------------------------------------------------------------------
    //  section 4: roadworks, low bridges, the trailer
    // ------------------------------------------------------------------------------------------------------------
    cones(w, R, items, [-1, 1], -566);
    cones(w, R, items, [0, 1], -612);
    cones(w, R, items, [-1, 0], -660);
    cones(w, R, items, [-1, 1], -706);
    BRIDGES.forEach((z) => lowBridge(w, R, items, z));
    sign(w, 'ROADWORKS · WE WORK ON YOU', 0, 7.2, -556, { w: 12, h: 1.8, size: 40, border: '#ffc83d' });
    at('works', -548, () => { tell('all', 'coop.l12.works'); tell(R.driver, 'coop.l12.works.driver'); tell(other(R.driver), 'coop.l12.works.nav'); });
    at('bridge1', -575, () => tell('all', 'coop.l12.bridge1'));
    at('bridge3', -672, () => tell('all', 'coop.l12.bridge3'));

    // ------------------------------------------------------------------------------------------------------------
    //  rest stop: swap seats (stand on your colour, together, for a moment)
    // ------------------------------------------------------------------------------------------------------------
    const pa = plate(w, { x: -6, y: 0, z: Z_B4 - 5, need: 'p1', label: `${N.p1}: SWAP` });
    const pb = plate(w, { x: 6, y: 0, z: Z_B4 - 5, need: 'p2', label: `${N.p2}: SWAP` });
    const exitGate = gate(w, { x: 0, y: 0, z: Z_B4 - 11.5, w: 30, h: 5 });
    sign(w, 'REST STOP · SWAP SEATS TO CONTINUE', 0, 7.0, Z_B4 + 6, { w: 11, h: 1.5, size: 38, border: '#ffc83d' });
    let swapHold = 0;
    w.updaters.push((dt) => {
      swapHold = pa.pressed && pb.pressed && !R.swapped ? swapHold + dt : 0;
      if (swapHold > 1.4) { swapHold = 0; c.emit('rt:swap', 1); }
      exitGate.set(R.swapped);
    });
    c.onEvent('rt:swap', () => {
      if (R.swapped) return;
      R.swapped = true;
      c.set('driver', other(R.driver));
      tell(R.driver, 'coop.l12.swapped.nav');
      tell(other(R.driver), 'coop.l12.swapped.driver');
    });
    at('rest', Z_B4 + 6, () => tell('all', 'coop.l12.rest'));

    // ------------------------------------------------------------------------------------------------------------
    //  the tunnel: dark; the navigator's headlight shows the road pieces
    // ------------------------------------------------------------------------------------------------------------
    const tunLen = Math.abs(Z_TUN1 - Z_TUN0);
    {
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, tunLen, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x03040a, side: THREE.BackSide, fog: false }));
      hull.rotation.x = Math.PI / 2; hull.position.set(0, 3, (Z_TUN0 + Z_TUN1) / 2); w.add(hull);
      const ring = (z) => { const r = new THREE.Mesh(new THREE.TorusGeometry(17, 0.5, 8, 40), glowMaterial(0xffc83d, 1.2)); r.position.set(0, 3, z); w.add(r); };
      ring(Z_TUN0); ring(Z_TUN1);
      sign(w, 'TUNNEL · NAVIGATOR HAS THE HEADLIGHT', 0, 9.8, Z_TUN0 + 3, { w: 13, h: 1.7, size: 40, border: '#9fe8ff' });
      sign(w, 'THE STUDS MARK THE MIDDLE OF EACH PIECE', 0, 7.6, Z_TUN0 + 3, { w: 13, h: 1.3, size: 36, border: '#fff1b0' });
    }
    const tunPlats = tunnelPieces.map((pc) => {
      const p = w.plat({ x: pc.x, y: pc.y, z: pc.z, w: pc.w, d: pc.d, h: 0.8, tex: 'metal', color: 0x6a7080, trim: 0xfff1b0 });
      for (let k = -1; k <= 1; k++) stud(w, pc.x, pc.y, pc.z + k * (pc.d / 2 - 0.7));
      p.group.visible = false;
      p.pc = pc;
      return p;
    });
    const tslab = w.hazard({ x: 0, y: -8, z: (Z_TUN0 + Z_TUN1) / 2, w: 40, h: 1, d: tunLen });
    tslab.group.visible = false;
    w.checkpoint({ x: tunnelPieces[6].x, y: tunnelPieces[6].y, z: tunnelPieces[6].z, real: true, label: 'HALFWAY' });
    // the beam: where is the navigator looking?
    const beamGeo = new THREE.CylinderGeometry(0.15, 15, 34, 24, 1, true);
    beamGeo.translate(0, -17, 0); beamGeo.rotateX(-Math.PI / 2);                       // tip at the origin, widening towards -Z
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.visible = false; w.add(beam);
    let beamT = 0;
    const lit = new THREE.Vector3(), fw = new THREE.Vector3(), pt = new THREE.Vector3();
    w.updaters.push((dt) => {
      beamT += dt; if (beamT < 0.07) return; beamT = 0;
      const nav = other(R.driver);
      let s;
      if (nav === me) s = { x: pl.x, y: pl.y + 1.5, z: pl.z, yaw: game.yaw, pitch: game.pitch };
      else if (P.has) s = { x: P.sx, y: P.sy + 1.5, z: P.sz, yaw: P.yaw, pitch: P.pitch };
      const inTunnel = s && s.z < Z_TUN0 + 8 && s.z > Z_TUN1 - 8;
      beam.visible = !!(inTunnel && nav !== me);
      if (!inTunnel) { for (const p of tunPlats) p.group.visible = false; return; }
      fw.set(-Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.cos(s.yaw) * Math.cos(s.pitch));
      lit.set(s.x, s.y, s.z);
      beam.position.copy(lit); beam.lookAt(lit.x + fw.x, lit.y + fw.y, lit.z + fw.z);
      for (const p of tunPlats) {
        const b = p.body, top = b.y + b.hy;
        let on = false;
        for (const [ox, oz] of [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          pt.set(b.x + ox * b.hx * 0.9, top, b.z + oz * b.hz * 0.9).sub(lit);
          const dist = pt.length();
          if (dist < 36 && dist > 0.1 && pt.dot(fw) / dist > 0.9) { on = true; break; }
        }
        p.group.visible = on;
      }
    });
    // both inside the tunnel: the (empty) car is driven to the exit bay
    const tzA = Z_TUN0 - 25, tzB = Z_TUN1 + 10;
    const tunBoth = c.zone({ x: 0, y: 1, z: (tzA + tzB) / 2, w: 40, h: 14, d: Math.abs(tzA - tzB), need: 'both', shrink: 0 });
    tunBoth.onChange((zn) => { if (zn.active && R.sec === 4 && R.mode === 'parked' && R.z > Z_B4 - 20) c.emit('rt:reloc', 1); });
    stage(w, 'tunnel', { x: 0, y: 2, z: Z_TUN0 - 6, w: 30, h: 8, d: 4 }, () => { tell(other(R.driver), 'coop.l12.tunnel.nav'); tell(R.driver, 'coop.l12.tunnel.driver'); });
    stage(w, 'tunnelmid', { x: 0, y: 2, z: tunnelPieces[6].z, w: 30, h: 8, d: 4 }, () => tell('all', 'coop.l12.tunnel.mid'));
    stage(w, 'tunneldone', { x: 0, y: 2, z: Z_TUN1 - 3, w: 30, h: 8, d: 3 }, () => tell('all', 'coop.l12.tunnel.done'));

    // ------------------------------------------------------------------------------------------------------------
    //  the chase
    // ------------------------------------------------------------------------------------------------------------
    cones(w, R, items, [-1, 0], Z_B6 - 40);
    [-1, 0, 1].forEach((l, i) => arm(w, R, items, { x: laneX(l), z: Z_B6 - 66, width: 6.4, side: 1, a: (t) => cycle(t, { period: 9, open: 5.2, offset: [0, 3, 6][i], rampDown: 1.4 }) }));
    cones(w, R, items, [0, 1], Z_B6 - 90);
    crossing(w, R, items, Z_B6 - 116, { period: 12, open: 8, offset: 4, rampDown: 1.5 });
    cones(w, R, items, [-1], Z_B6 - 140);
    [-1, 0, 1].forEach((l, i) => arm(w, R, items, { x: laneX(l), z: Z_B6 - 164, width: 6.4, side: 1, a: (t) => cycle(t, { period: 9, open: 5.2, offset: [3, 6, 0][i], rampDown: 1.4 }) }));
    cones(w, R, items, [-1, 1], Z_B6 - 188);
    sign(w, 'THE VAN IS COMING. KEEP MOVING. BRAKE ONLY IF YOU MUST.', 0, 7.4, Z_B6 - 14, { w: 13, h: 1.7, size: 36, border: '#ff4d5e' });
    at('chase', Z_B6 - 4, () => { tell('all', 'coop.l12.chase'); });
    w.updaters.push(() => { if (R.chOn && R.gap < 18) once('coop.l12.van.close', 'all'); });
    at('s6done', Z_B7 + 6, () => tell('all', 'coop.l12.finish'));
    const GOAL = { x: 0, z: Z_B7 - 4 };
    w.goal({ x: GOAL.x, y: 0, z: GOAL.z });
    beacon(w, GOAL.x, 0, GOAL.z, 0xffe9a8, 20);

    w.hooks.onPartnerDeath = () => { tell('all', 'coop.l12.partnerdown'); return true; };

    // ------------------------------------------------------------------------------------------------------------
    //  scripted bots (tools/coop-bot.mjs): they use the same facts a human reads from the map
    // ------------------------------------------------------------------------------------------------------------
    const arrival = (it, v) => {                                         // [metres until the car's nose reaches it, metres until the car's tail has left it]
      const zNear = it.z + (it.hd ?? 0.6), zFar = it.z - (it.hd ?? 0.6);
      return [R.z - 3.25 - zNear, R.z + 3.25 - zFar, v];
    };
    const blocksLane = (it, lane, S) => {
      if (it.kind === 'low' || it.kind === 'kerb') return false;
      if (Math.abs(it.x - laneX(lane)) >= it.hw + 2.2) return false;
      if (it.kind !== 'arm') return true;
      const [dIn, dOut] = arrival(it, S.v);
      const t0 = Math.max(0, dIn) / S.v + 0.7, t1 = Math.max(0, dOut) / S.v + 0.7;
      for (let t = t0 - 0.7; t <= t1 + 0.7; t += 0.3) if (it.f(w.t + t) < 0.9) return true;
      return false;
    };
    const oracle = () => {
      const S = SEC[R.sec]; let lane = R.lane, brake = false;
      if (!S) return { lane, brake };
      // forced lanes at the forks (the sign + the map tell a human)
      if (R.sec === 2) {
        if (R.z < -396 && R.z > -466) return { lane: 1, brake: false };
        if (R.z <= -466 && R.z > -530) return { lane: -1, brake: false };
      }
      const rel = items.filter((it) => { const [dIn, dOut] = arrival(it, S.v); return it.kind !== 'kerb' && dOut > 0 && dIn < 34; });
      if (rel.length) {
        const dMin = Math.min(...rel.map((it) => arrival(it, S.v)[0]));
        const cl = rel.filter((it) => arrival(it, S.v)[0] < dMin + 9);
        const order = [R.lane, 0, -1, 1].filter((l, i, a) => a.indexOf(l) === i);
        const free = order.find((l) => !cl.some((it) => blocksLane(it, l, S)));
        if (free !== undefined) lane = free;
        else brake = dMin < 16 && !(R.chOn && R.gap < 8);
      }
      if (R.sec === 1 && !R.paid) {                                       // line up with the kerb, stop alongside the pad
        if (R.z < -224) lane = 1;
        if (R.z <= PAY.z + 3.2) brake = true;
      } else if (R.sec === 1 && R.v < 0.3 && R.z > -300 && R.z < -240 && !(onCar(pl) && onCar(partnerPos()))) brake = true;   // wait for the navigator to hop back on
      return { lane, brake };
    };
    const winBridge = () => {
      const S = SEC[R.sec]; if (!S || !S.trailer) return false;
      return BRIDGES.some((bz) => { const a = R.z - bz; return a < 20 && a > -10.2; });
    };
    const tunWps = [{ x: 0, z: Z_B4 - 8 }, { x: 0, z: Z_TUN0 - 0.5 }, ...tunnelPieces.map((q) => ({ x: q.x, z: q.z })), { x: 0, z: Z_TUN1 - 5 }];
    w.botPlan = () => {
      const drv = R.driver === me;
      if (R.sec >= 5) return { x: GOAL.x, z: GOAL.z, r: 0.5 };
      const S = SEC[R.sec];
      // rest stop + tunnel on foot
      if (R.sec === 4 && R.mode !== 'drive' && pl.z > Z_TUN1 - 3 && (R.z > Z_B4 - 8 || pl.z > Z_TUN1 + 1)) {
        if (!R.swapped) return { x: me === 'p1' ? -6 : 6, z: Z_B4 - 5, r: 0.4, wait: Math.hypot(pl.x - (me === 'p1' ? -6 : 6), pl.z - (Z_B4 - 5)) < 0.7 };
        const wp = tunWps.find((q) => q.z < pl.z - 1.6) || tunWps[tunWps.length - 1];
        return { x: wp.x, z: wp.z, r: 0.5 };
      }
      const car = (lx, lz) => ({ x: R.x + lx, z: R.z + lz });
      // everyone hops on the trailer under a low bridge
      if (winBridge() && R.trailerOn) { const t = car(0, TR_OFF); return { x: t.x, z: t.z, r: 0.6, wait: Math.hypot(pl.x - t.x, pl.z - t.z) < 0.9 }; }
      if (drv) {
        const want = oracle();
        let tgt;
        if (R.lane !== want.lane) tgt = car(want.lane * 1.75, -2.3);
        else if (want.brake) tgt = car(0, -0.7);
        else tgt = car(R.lane * 1.75, -2.3);
        return { x: tgt.x, z: tgt.z, r: 0.35, wait: Math.hypot(pl.x - tgt.x, pl.z - tgt.z) < 0.45 };
      }
      // navigator
      if (R.sec === 1 && !R.paid && R.z < -240 && R.v < 0.4) return { x: PAY.x, z: PAY.z, r: 0.5, wait: Math.hypot(pl.x - PAY.x, pl.z - PAY.z) < 0.6 };
      if (R.sec === 1 && pl.x > 10 && pl.y > 0.8) { const t = car(0, 2.4); return { x: t.x, z: t.z, r: 0.5 }; }
      const t = car(0, 2.4);
      return { x: t.x, z: t.z, r: 0.5, wait: Math.hypot(pl.x - t.x, pl.z - t.z) < 0.8 };
    };
    w.botIndex = () => R.sec * 10 + (R.mode === 'drive' ? 1 : 0);
    w.rt = R; R.SEC = SEC; R.tun = tunnelPieces; R.Z = { B4: Z_B4, B6: Z_B6, B7: Z_B7, TUN0: Z_TUN0, TUN1: Z_TUN1 };      // debug handles
  },
};
