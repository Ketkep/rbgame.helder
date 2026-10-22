import * as THREE from 'three';
import { glowMaterial, plainMaterial, softTexture } from '../../engine/materials.js';
import { retreatEnv, deck, plate, gate, sign, roleSign, lake, stage, botSteps, beacon, COL } from './kit.js';
import { makeLight, bridge, fire, firePad } from './campsite-kit.js';

// Session 14 — The Campsite. A night hike with ONE lantern. The lantern is a shared value (who holds it, or which post it hangs on); platforms
// are only drawn and only solid near it (the holder's synced position; ghost outlines elsewhere). Stages: 1 pick up the lantern + a lit trail,
// 2 hand it over (the trail is teal-lit), 3 stay-close bridge (exists only within 6 m of each other), 4 two campfires (stoke the fire while the
// other carries the light across, then swap), 5 fireflies (collect in order, the order is only shown to whoever is NOT holding the lantern),
// 6 the relay (orange-lit, teal-lit, orange-lit legs: hand the lantern over at each post) and the toss across a gap from a hand-over pad,
// 7 the summit: two lanterns at once, a spiral climb, a marshmallow checkpoint, a last drawbridge, and the circle.
// Night. First-time pairs: ~10 minutes.

export default {
  id: 'coop14',
  name: 'The Campsite',
  music: 'l1',
  deathRule: 'self',
  completeQuip: 'One lantern. Two of you. Zero marshmallows eaten. The counsellor is, frankly, a little warm.',
  titleCam: { center: [0, 2, -40], radius: 30, height: 12 },

  build(w, game) {
    retreatEnv(w, { mood: 'night' });
    w.setTheme({ edge: 0xb8c8ff, edgeOpacity: 0.7 });                 // every platform keeps a faint rim: nobody falls without a tell
    lake(w, -30);
    const c = w.coop, me = c.me, N = c.names, P = c.partner;
    const tell = (r, k, o) => c.tell(r, k, o);
    w.spawn = { x: me === 'p1' ? -1.8 : 1.8, y: 0, z: 4, yaw: 0 };
    w.respawn = { ...w.spawn };
    const L = makeLight(w);
    const g = game;
    const rr = c.rng(14);

    // ---------------------------------------------------------------- helpers
    const cur = { x: 0, y: 0, z: -26 };
    const TRIM = { any: 0x8fb0ff, p1: COL.p1, p2: COL.p2, post: 0xffd9a0 };
    const stones = (specs, o = {}) => L.trail(cur, specs, { color: 0xd2bc98, trim: TRIM[o.who || (o.post ? 'post' : 'any')], ...o });
    const base = (d, wd = 18, o = {}) => {
      const gap = o.gap ?? 2.4; delete o.gap;
      cur.z -= gap; cur.x = 0;
      const z0 = cur.z; cur.z -= d;
      const p = deck(w, { x: 0, y: cur.y, z: z0 - d / 2, w: wd, d, path: true, ...o });
      return { p, z0, z1: cur.z, zc: z0 - d / 2, y: cur.y };
    };
    const cp = (zc, y = cur.y, x = 0) => w.checkpoint({ x, y, z: zc, real: true });
    const spec = (rows) => rows.map(([gap, d, wd, dx, dy]) => ({ gap, d, w: wd, dx: dx || 0, dy: dy || 0 }));
    const tent = (x, y, z, rot, col) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.2, 4), plainMaterial(col, { roughness: 0.9 }));
      m.position.set(x, y + 1.1, z); m.rotation.y = rot + Math.PI / 4; m.castShadow = true; w.add(m);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), glowMaterial(0xffc880, 0.9));
      door.position.set(x + Math.sin(rot) * 1.5, y + 0.7, z + Math.cos(rot) * 1.5); door.rotation.y = rot; w.add(door);
    };
    const log = (x, y, z, rot) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.4, 8), plainMaterial(0x4a3326, { roughness: 0.9 })); m.position.set(x, y + 0.28, z); m.rotation.set(Math.PI / 2, 0, rot); m.castShadow = true; w.add(m); };

    // ================================================================ 1. the camp: one lantern ===================
    deck(w, { x: 0, y: 0, z: -10, w: 26, d: 32, path: true });                       // z 6 … -26
    sign(w, 'SESSION 14 · THE CAMPSITE', 0, 10.8, -16, { w: 14, h: 1.9 });
    tent(-9, 0, 0, 0.5, 0xc2603a); tent(9.5, 0, -3, -0.6, 0x3a7fa8); tent(-10.5, 0, -17, 0.9, 0x6a8f3a);
    log(7, 0, -14, 0.4); log(10, 0, -16, -0.3);
    fire(w, 8, 0, -20, () => 0.35);
    L.post('0', 0, 0, -12);
    sign(w, 'ONE LANTERN. TWO OF YOU.', 0, 4.6, -12, { w: 8, h: 1.1, size: 40 });
    sign(w, 'E: TAKE IT · ONLY ONE OF YOU CAN CARRY IT', 0, 3.4, -12, { w: 9.2, h: 0.8, size: 28, border: '#ffd9a0' });
    stage(w, 'welcome', { x: 0, y: 1, z: 2, w: 30, h: 4, d: 8 }, () => { tell('p1', 'coop.l14.intro.p1', { priority: 2 }); tell('p2', 'coop.l14.intro.p2', { priority: 2 }); });
    let tookFirst = false;
    c.on('holder', (v) => {
      if (v === 'p1' || v === 'p2') {
        if (!tookFirst) { tookFirst = true; tell('all', 'coop.l14.take'); }
        else if (v !== lastHolder && lastHolder && lastHolder !== 'post:0') tell('all', 'coop.l14.handed');
      }
      lastHolder = v;
    });
    let lastHolder = null;
    cp(-24);

    // ================================================================ 2. the lit trail ==========================
    stones(spec([
      [2.2, 4, 5, 0, 0], [2.4, 4, 4.4, 2, 0], [2.6, 3.5, 4.2, 2, 0], [2.4, 4.5, 4.4, -3, 0], [2.6, 4, 4.2, -2, 1.0], [2.4, 4, 4.4, 2, 0],
      [2.6, 3.5, 4.2, 3, 0], [2.4, 4, 4.4, -1, -1.0], [2.8, 4, 4.2, -3, 0], [2.4, 4.5, 4.4, -1, 0], [2.6, 4, 4.2, 2, 1.2], [2.4, 4, 5, 0, 0],
    ]));
    sign(w, 'THE DARK PLATFORMS ARE NOT THERE. THE OUTLINES ARE A WARNING.', 0, 6.5, -34, { w: 11, h: 1.5, size: 30 });
    stage(w, 'trail', { x: 0, y: 1, z: -27, w: 26, h: 4, d: 3 }, () => tell('all', 'coop.l14.trail'));
    const B1 = base(10, 18);
    cp(B1.zc, B1.y);
    const post1 = L.post('1', -4.5, B1.y, B1.zc - 0.5);
    sign(w, 'HAND IT OVER: STAND TOGETHER, PRESS E AT A POST', 4, B1.y + 3.4, B1.zc - 3, { w: 8.6, h: 1.5, size: 30, border: '#ffd9a0' });
    stage(w, 'post1', { x: 0, y: B1.y + 1, z: B1.z0 - 1.5, w: 18, h: 4, d: 3 }, () => tell('all', 'coop.l14.post1'));
    // TEAL-lit stones: only the teal player's lantern works on them
    stones(spec([[2.4, 4, 4.4, 0, 0], [2.6, 4, 4.4, 2, 0], [2.4, 4.5, 4.2, -2, 1.0], [2.6, 4, 4.4, 0, 0]]), { who: 'p2' });
    sign(w, 'TEAL LIGHT ONLY', 0, cur.y + 3.8, cur.z + 6, { w: 6.4, h: 1.0, size: 40, border: '#39d7c9', color: '#7ff5e8' });
    stage(w, 'teal', { x: 0, y: B1.y + 1, z: B1.z1 - 1.5, w: 18, h: 4, d: 3 }, () => { tell('p2', 'coop.l14.teal.p2'); tell('p1', 'coop.l14.teal.p1'); });

    // ================================================================ 3. the stay-close bridge ===================
    const B2 = base(10, 18);
    cp(B2.zc, B2.y);
    sign(w, 'STAY WITHIN 6 METRES OF EACH OTHER', 0, B2.y + 4.8, B2.z1 - 0.5, { w: 11, h: 1.3, size: 34, border: '#ff8a5c' });
    sign(w, 'THE BRIDGE ONLY EXISTS WHILE YOU ARE CLOSE', 0, B2.y + 3.4, B2.z1 - 0.5, { w: 11, h: 0.9, size: 28, border: '#ff8a5c' });
    const closeK = () => { const d = L.pair(); return d < 5.9 ? 2 : d < 7.4 ? 1 : 0; };
    const trims = [];
    let warnT = 0;
    const planks = stones(spec([
      [1.2, 3.6, 3.4, 0, 0], [1.0, 3.6, 3.4, 1.6, 0], [1.0, 3.6, 3.4, 1.6, 1.0], [1.0, 3.6, 3.4, -1.6, 0], [1.0, 3.6, 3.4, -1.6, 0], [1.0, 3.6, 3.4, -1.6, -1.0],
      [1.0, 3.6, 3.4, 1.6, 0], [1.0, 3.6, 3.4, 1.6, 1.0], [1.0, 3.6, 3.4, 0, 0], [1.0, 3.6, 3.4, -1.6, 0], [1.0, 3.6, 3.4, 0, -1.0],
    ]), { cond: closeK, trim: 0x66aaff });
    for (const p of planks) trims.push(p.group.children[1].material);
    w.updaters.push((dt, t) => {
      const d = L.pair(), k = Math.max(0, Math.min(1, (d - 3.8) / 2.1));
      for (const m of trims) m.color.setRGB(0.4 + 1.7 * k, 0.67 - 0.5 * k, 1.0 - 0.8 * k).multiplyScalar(1.8);
      warnT = Math.max(0, warnT - dt);
      if (d > 5.0 && d < 9 && warnT <= 0 && g.player.z < B2.z1 - 2 && g.player.z > planks[planks.length - 1].body.z - 4) { warnT = 7; tell('all', 'coop.l14.apart'); }
    });
    stage(w, 'close', { x: 0, y: B2.y + 1, z: B2.z1 - 1.5, w: 18, h: 4, d: 3 }, () => tell('all', 'coop.l14.close'));
    const B3 = base(10, 18, { gap: 1.2 });
    cp(B3.zc, B3.y);
    stage(w, 'closedone', { x: 0, y: B3.y + 1, z: B3.zc, w: 18, h: 4, d: 4 }, () => tell('all', 'coop.l14.closedone'));

    // ================================================================ 4. two fires ===============================
    // stoker stands on the fire's pad (and must NOT hold the lantern: hands full); the other one carries the light over the drawbridge,
    // then stands on the far pad to keep it down for the stoker.
    const firePair = (n, stoker) => {
      const crosser = stoker === 'p1' ? 'p2' : 'p1';
      const S = base(14, 18, { gap: n === 1 ? 2.4 : 2.4 });
      cp(S.zc, S.y);
      const px = stoker === 'p1' ? -5.5 : 5.5;
      L.post('f' + n, -px, S.y, S.z0 - 4);
      const fireLvl = { v: 0 };
      const pad = firePad(w, L, { x: px, y: S.y, z: S.z0 - 8, role: stoker, label: `${N[stoker]}: STOKE (HOLD)` });
      fire(w, px, S.y, S.z0 - 11.5, () => fireLvl.v);
      sign(w, 'NO FREE HANDS: PUT THE LANTERN DOWN (HAND IT OVER)', px, S.y + 4.4, S.z0 - 11.5, { w: 7.8, h: 1.0, size: 26, border: '#ff8a5c' });
      sign(w, `${N[stoker]} FEEDS THE FIRE · ${N[crosser]} CARRIES THE LIGHT`, 0, S.y + 6.2, S.z1 + 3, { w: 12.5, h: 1.3, size: 28 });
      // the drawbridge (lit; sunk unless the fire is fed or the far pad is held)
      const relay = { zn: null };
      const bx = 0, bz = S.z1 - 4.5;
      const br = bridge(w, L, { x: bx, y: S.y, z: bz, w: 5, d: 9, h: 1, path: true, trim: 0xffb347 }, () => pad.pressed || relay.zn.pressed);
      const S2 = (() => { cur.z = S.z1 - 9; return base(14, 18, { gap: 0 }); })();
      cp(S2.zc, S2.y);
      relay.zn = plate(w, { x: 4.5, y: S2.y, z: S2.z0 - 3, need: 'any', hold: 3.5, label: 'FAR PAD: HOLD IT FOR YOUR PARTNER' });
      w.updaters.push((dt) => { fireLvl.v += ((pad.pressed ? 1 : 0.18) - fireLvl.v) * Math.min(1, dt * 3); });
      stage(w, 'fire' + n, { x: 0, y: S.y + 1, z: S.z0 - 1, w: 18, h: 4, d: 2 }, () => { tell(stoker, 'coop.l14.fire' + n + '.stoke'); tell(crosser, 'coop.l14.fire' + n + '.cross'); });
      stage(w, 'fire' + n + 'done', { x: 0, y: S2.y + 1, z: S2.zc, w: 18, h: 4, d: 4 }, () => tell('all', 'coop.l14.fire' + n + 'done'));
      return { S, S2, pad, relay: relay.zn, br, stoker, crosser, px };
    };
    const F1 = firePair(1, 'p1');                            // p1 stokes, p2 (teal, holding the lantern) crosses
    const postS2 = L.post('s2', -5.5, F1.S2.y, F1.S2.z0 - 8);
    stones(spec([[2.4, 4, 4.6, 0, 0], [2.6, 4, 4.4, 2, 0], [2.4, 3.5, 4.4, 2, 1.0], [2.6, 4.5, 4.2, -2, 0], [2.4, 4, 4.4, -2, 0], [2.6, 4, 4.6, 0, -1.0]]));
    const F2 = firePair(2, 'p2');                            // p2 stokes, p1 crosses (so the lantern changes hands at the post on the way)
    sign(w, 'NOW IT IS THE OTHER WAY ROUND', 0, F1.S2.y + 4.4, F1.S2.z1 + 3, { w: 9, h: 1.0, size: 30 });

    // ================================================================ 5. fireflies ===============================
    stones(spec([[2.4, 4, 4.6, 0, 0], [2.6, 4, 4.4, -2, 0], [2.4, 4, 4.6, 2, 0]]));
    const H = base(22, 14);
    cp(H.zc, H.y);
    const FF = [{ name: 'ROSE', hex: 0xff6fb5, css: '#ff6fb5', x: -17, z: H.z0 - 8 }, { name: 'GOLD', hex: 0xffd24d, css: '#ffd24d', x: 17, z: H.z0 - 12 }, { name: 'BLUE', hex: 0x6fa8ff, css: '#6fa8ff', x: -17, z: H.z0 - 17 }];
    const seq = [0, 1, 2];
    for (let i = 2; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [seq[i], seq[j]] = [seq[j], seq[i]]; }
    for (const f of FF) {
      const side = f.x < 0 ? -1 : 1;
      L.plat({ x: side * 10.6, y: H.y, z: f.z, w: 2.6, d: 3.4, h: 1, color: 0xd2bc98, trim: 0xffd24d });
      deck(w, { x: f.x, y: H.y, z: f.z, w: 6, d: 6 });
    }
    w.campsite = { seq, L, FF };
    const hubPost = L.post('h', 4.5, H.y, H.z0 - 3);
    const orbs = FF.map((f, k) => {
      const grp = new THREE.Group(); grp.position.set(f.x, H.y + 1.7, f.z); w.add(grp);
      grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), glowMaterial(f.hex, 2.6)));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: f.hex, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.set(3.2, 3.2, 1); grp.add(halo);
      sign(w, f.name, f.x, H.y + 3.4, f.z, { w: 3, h: 0.8, size: 40, border: f.css, color: f.css });
      const zn = c.zone({ x: f.x, y: H.y + 1.7, z: f.z, w: 3.0, h: 3.4, d: 3.0, need: 'any', shrink: 0 });
      zn.onChange((z) => { if (z.active) c.emit('ff', { k, r: (c.get('ffs', { r: 0, n: 0 })).r }); });
      return { grp, halo, f, k };
    });
    // authority: the host decides, everything else is derived from the shared 'ffs' = {r: round, n: collected}
    c.onEvent('ff', (a) => {
      if (!c.isHost || !a) return;
      const s = c.get('ffs', { r: 0, n: 0 });
      if (a.r !== s.r || s.n >= 3) return;
      if (seq.indexOf(a.k) < s.n) return;                     // already collected
      if (a.k === seq[s.n]) c.set('ffs', { r: s.r, n: s.n + 1 });
      else c.set('ffs', { r: s.r + 1, n: 0 });
    });
    let lastFF = { r: 0, n: 0 };
    c.on('ffs', (s) => {
      if (s.r > lastFF.r) tell('all', 'coop.l14.ff.wrong');
      else if (s.n === 3 && lastFF.n < 3) tell('all', 'coop.l14.ff.done');
      else if (s.n > lastFF.n) tell('all', 'coop.l14.ff.ok');
      lastFF = s;
    });
    const gz = H.z1 + 0.6;
    const gFF = gate(w, { x: 0, y: H.y, z: gz, w: 14, h: 5.4, glow: 0xffd24d });
    const lampOrbs = [-3.5, 0, 3.5].map((x, k) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), glowMaterial(0x40302a, 1)); m.position.set(x, H.y + 5.9, gz + 1.0); w.add(m); return m; });
    w.updaters.push((dt, t) => {
      const s = c.get('ffs', { r: 0, n: 0 });
      gFF.set(s.n >= 3);
      orbs.forEach((o) => { const got = seq.indexOf(o.k) < s.n; o.grp.visible = !got; o.grp.position.y = H.y + 1.7 + Math.sin(t * 2 + o.k) * 0.18; o.grp.position.x = o.f.x + Math.cos(t * 1.3 + o.k * 2) * 0.5; });
      lampOrbs.forEach((m, i) => { const on = i < s.n; m.material.color.setHex(on ? FF[seq[i]].hex : 0x40302a).multiplyScalar(on ? 2.6 : 1); });
      boardRead.visible = L.holder() !== me; boardHide.visible = L.holder() === me;
    });
    const boardRead = sign(w, `ORDER:  1 ${FF[seq[0]].name}  →  2 ${FF[seq[1]].name}  →  3 ${FF[seq[2]].name}`, 0, H.y + 3.6, H.z0 - 1.2, { w: 11.5, h: 1.3, size: 30, border: '#ffd24d' });
    const boardHide = sign(w, 'THE ORDER IS ONLY SHOWN TO WHOEVER IS NOT HOLDING THE LANTERN', 0, H.y + 3.6, H.z0 - 1.2, { w: 11.5, h: 1.3, size: 26, border: '#ff4d5e' });
    sign(w, 'LIGHT THE FIREFLIES IN ORDER · WRONG ONE AND THEY START AGAIN', 0, H.y + 6.0, gz + 1.0, { w: 12.5, h: 0.95, size: 26, border: '#ffd24d' });
    stage(w, 'ff', { x: 0, y: H.y + 1, z: H.z0 - 2, w: 14, h: 4, d: 3 }, () => tell('all', 'coop.l14.ff.intro'));

    // ================================================================ 6. the relay and the toss =================
    stones(spec([[2.4, 4, 4.6, 0, 0], [2.6, 4, 4.4, 2, 0], [2.4, 4, 4.4, -2, 0]]));
    const M0 = base(8, 16); cp(M0.zc, M0.y);
    L.post('m0', 4.5, M0.y, M0.zc);
    sign(w, 'ORANGE LIGHT FIRST', 0, M0.y + 4.4, M0.z1 + 0.6, { w: 8, h: 1.1, size: 36, border: '#ff9a3d', color: '#ffb866' });
    stage(w, 'relay', { x: 0, y: M0.y + 1, z: M0.z0 - 1.5, w: 16, h: 4, d: 3 }, () => tell('all', 'coop.l14.relay'));
    stones(spec([[2.4, 4, 4.4, 0, 0], [2.6, 4, 4.4, 2, 0], [2.4, 3.5, 4.2, 2, 1.0], [2.6, 4.5, 4.4, -2, 0], [2.4, 4, 4.4, -2, 0], [2.6, 4, 4.6, 0, 0]]), { who: 'p1' });
    const M1 = base(8, 16); cp(M1.zc, M1.y);
    L.post('m1', -4.5, M1.y, M1.zc);
    sign(w, 'NOW TEAL', 0, M1.y + 4.4, M1.z1 + 0.6, { w: 6, h: 1.1, size: 40, border: '#39d7c9', color: '#7ff5e8' });
    stones(spec([[2.4, 4, 4.4, 0, 0], [2.6, 4, 4.4, -2, 0], [2.4, 4, 4.2, -2, -1.0], [2.6, 4.5, 4.4, 2, 0], [2.4, 4, 4.4, 2, 1.0], [2.6, 4, 4.6, 0, 0]]), { who: 'p2' });
    const M2 = base(8, 16); cp(M2.zc, M2.y);
    L.post('m2', 4.5, M2.y, M2.zc);
    sign(w, 'ORANGE AGAIN', 0, M2.y + 4.4, M2.z1 + 0.6, { w: 7, h: 1.1, size: 38, border: '#ff9a3d', color: '#ffb866' });
    stones(spec([[2.4, 4, 4.4, 0, 0], [2.6, 3.5, 4.2, 2, 0], [2.4, 4, 4.4, 2, 1.2], [2.6, 4, 4.4, -2, 0], [2.4, 4.5, 4.4, -2, 0]]), { who: 'p1' });
    const M3 = base(12, 16); cp(M3.zc, M3.y);
    L.post('m3', -5.5, M3.y, M3.z0 - 3);
    // the long toss: no stones, only a bridge that exists while the lantern hangs on the far post
    const padZ = M3.z1 + 3.2;
    const tpad = new THREE.Mesh(new THREE.BoxGeometry(5, 0.12, 4), glowMaterial(0xffd9a0, 1.2)); tpad.position.set(0, M3.y + 0.06, padZ); w.add(tpad);
    sign(w, 'HAND-OVER PAD · BOTH OF YOU STAND HERE', 0, M3.y + 4.2, padZ - 1, { w: 8.6, h: 1.0, size: 28, border: '#ffd9a0' });
    w.interactable({ x: 0, y: M3.y + 1.5, z: padZ - 2.4, w: 5.6, h: 3, d: 1.0, range: 4.5, enabled: () => L.holder() === me && L.mode === 'one',
      label: () => (tossZ.active ? 'THROW the lantern to the far post' : 'THROW the lantern (BOTH of you on the pad first)'),
      onUse: () => { if (tossZ.active) c.emit('toss', { to: 'far' }); else tell('all', 'coop.l14.tossboth'); } });
    const tossZ = c.zone({ x: 0, y: M3.y + 1.5, z: padZ, w: 5, h: 3, d: 4, need: 'both', shrink: 0 });
    c.onEvent('toss', (a) => { if (a && a.to === 'far' && c.get('holder') !== 'post:far') { c.set('holder', 'post:far'); tell('all', 'coop.l14.toss'); } });
    sign(w, 'THE BRIDGE ONLY EXISTS WHERE THE FAR LANTERN CAN SEE IT', 0, M3.y + 6.0, M3.z1 + 0.6, { w: 11, h: 1.0, size: 26, border: '#ff8a5c' });
    stage(w, 'toss', { x: 0, y: M3.y + 1, z: M3.z0 - 1.5, w: 16, h: 4, d: 3 }, () => tell('all', 'coop.l14.tossintro'));
    cur.z -= 0;
    const tossBridge = L.plat({ x: 0, y: M3.y, z: M3.z1 - 8, w: 5, d: 16, h: 1, post: 'far', path: true, color: 0xd2bc98, trim: 0xffd9a0 });
    cur.z = M3.z1 - 16;
    const F = base(12, 16, { gap: 0 }); cp(F.zc, F.y);
    L.post('far', -5, F.y, F.z0 - 3.5);
    // the twin post: from now on you each carry one
    w.interactable({ x: -5, y: F.y + 1.5, z: F.z0 - 8.5, w: 2.4, h: 3.2, d: 1.6, range: 4,
      enabled: () => L.mode === 'one' && L.holder() === 'post:far',
      label: () => 'Light the second lantern (from here you each carry one)',
      onUse: () => { c.set('lmode', 'two'); w.game.audio.confirm?.(); } });
    c.on('lmode', (v) => { if (v === 'two') tell('all', 'coop.l14.twin'); });
    sign(w, 'THE SUMMIT NEEDS TWO LIGHTS', -5, F.y + 4.8, F.z0 - 3.5, { w: 8.4, h: 1.1, size: 32, border: '#ffd9a0' });
    const twin = () => (L.mode === 'two' ? 2 : 0);

    // ================================================================ 7. the summit ============================
    const R = 9, D1 = 0.62;
    const zc0 = F.z1 - 2.4 - 1.8 - R;
    const spot = (a) => ({ x: R * Math.sin(a), z: zc0 + R * Math.cos(a) });
    let a = 0, y = F.y;
    const SUM = [];
    const step = (i) => {
      y += 1.0;
      const s = spot(a);
      SUM.push(L.plat({ x: s.x, y, z: s.z, w: 3.6, d: 3.6, h: 1, path: true, cond: twin, color: 0xd2bc98, trim: i % 2 ? COL.p2 : COL.p1 }));
      a += D1;
    };
    for (let i = 0; i < 11; i++) step(i);
    // marshmallow deck
    const aDeck = a + 0.28; y += 1.0;
    const ms = spot(aDeck);
    const MD = deck(w, { x: ms.x, y, z: ms.z, w: 8, d: 8, path: true });
    cp(ms.z, y, ms.x);
    const ymm = y;
    const mm = new THREE.Group(); mm.position.set(ms.x + 2.6, y, ms.z + 1.6); w.add(mm);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), plainMaterial(0x6b4a2e)); stick.position.set(0, 1.0, 0); stick.rotation.z = 0.5; mm.add(stick);
    const mallow = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 12), plainMaterial(0xfff3e6, { roughness: 0.9 })); mallow.position.set(-0.45, 1.95, 0); mallow.rotation.z = 0.5; mm.add(mallow);
    fire(w, ms.x - 2.4, y, ms.z - 1.4, () => 0.6);
    sign(w, 'MARSHMALLOW CHECKPOINT', ms.x, y + 4.2, ms.z + 3.2, { w: 8.6, h: 1.2, size: 36, border: '#fff3e6' });
    sign(w, 'IT IS A REAL CHECKPOINT. IT IS ALSO A MARSHMALLOW.', ms.x, y + 3.0, ms.z + 3.2, { w: 9.6, h: 0.8, size: 26, border: '#fff3e6' });
    stage(w, 'marsh', { x: ms.x, y: y + 1, z: ms.z, w: 8, h: 4, d: 8 }, () => tell('all', 'coop.l14.marsh'));
    a = aDeck + 0.9;
    for (let i = 0; i < 11; i++) step(i);
    // top deck + the last drawbridge
    a += 0.28; y += 1.0;
    const ts = spot(a);
    const TD = deck(w, { x: ts.x, y, z: ts.z, w: 10, d: 10, path: true });
    cp(ts.z, y, ts.x);
    const ytop = y;
    const tz1 = ts.z - 5;
    const topPad = plate(w, { x: ts.x, y, z: ts.z - 2.4, size: 2.8, need: 'any', hold: 0, label: 'HOLD: BRIDGE STAYS DOWN' });
    const relay2 = { zn: null };
    const last = bridge(w, L, { x: ts.x, y, z: tz1 - 4.5, w: 5, d: 9, h: 1, path: true, trim: 0xffb347 }, () => topPad.pressed || relay2.zn.pressed);
    const GI = deck(w, { x: ts.x, y, z: tz1 - 9 - 6, w: 14, d: 12, path: true });
    relay2.zn = plate(w, { x: ts.x + 4.5, y, z: tz1 - 9 - 2.5, size: 2.8, need: 'any', hold: 3.5, label: 'FAR PAD: HOLD IT FOR YOUR PARTNER' });
    const gx = ts.x, gzc = tz1 - 9 - 8.5;
    cp(tz1 - 9 - 4.5, y, ts.x);
    w.goal({ x: gx, y, z: gzc });
    beacon(w, gx, y, gzc, 0xffe9a8, 24);
    sign(w, 'BOTH OF YOU. IN THE CIRCLE. SOMEONE HAS TO LET GO OF THE FIRE FIRST.', gx, y + 5.4, gzc - 1, { w: 11.5, h: 1.5, size: 28 });
    stage(w, 'top', { x: ts.x, y: y + 1, z: ts.z, w: 10, h: 4, d: 10 }, () => tell('all', 'coop.l14.top'));
    stage(w, 'circle', { x: gx, y: y + 1, z: gzc + 2, w: 14, h: 4, d: 6 }, () => tell('all', 'coop.l14.circle'));
    w.hooks.onPartnerDeath = () => { tell('all', 'coop.l14.partnerdown'); return true; };
    let lastDeaths = g.deaths || 0;
    w.updaters.push(() => { if ((g.deaths || 0) !== lastDeaths) { lastDeaths = g.deaths || 0; if (L.mode === 'one') tell('all', 'coop.l14.fell'); } });
    const climb = ymm; void climb; void post1; void postS2; void hubPost; void MD; void TD; void GI; void tossBridge; void SUM;

    // ================================================================ scripted bots (tools/coop-bot.mjs) ============
    const near = (po, r = 4.2) => P.has && Math.hypot(P.sx - po.x, P.sz - po.z) < r && Math.abs(P.sy - po.y) < 2;
    const me2 = (who) => ({ p1: 'p2', p2: 'p1' })[who];
    const holder = () => L.holder();
    const take = (id, x, z) => ({ x, z, r: 0.3, use: true, until: () => holder() === me });
    // stand near a post with the partner, then hand over (holder) / wait for the lantern (receiver)
    const handoverSteps = (id, px, pz, from, to) => {
      const sx = px + (me === 'p1' ? -0.5 : 0.5), sz = pz + 1.4;
      if (me === from) return [{ x: sx, z: sz, r: 0.3, until: () => near({ x: px, z: pz, y: g.player.y }, 3.5) }, { x: sx, z: sz, r: 0.3, use: true, until: () => holder() === to }];
      return [{ x: sx, z: sz, r: 0.3, until: () => holder() === to }];
    };
    // stand together at a post and hand the lantern over: the giver lines up in front of the post (so the crosshair is on it), the receiver stands beside
    const handover = (px, pz, py, from, to) => {
      const side = px < 0 ? 1 : -1;
      if (me === from) return [
        { x: px, z: pz + 4, r: 0.7, until: () => holder() !== from || Math.hypot(g.player.x - px, g.player.z - (pz + 4)) < 0.9 },
        { x: px, z: pz + 1.4, r: 0.25, until: () => holder() !== from || (near({ x: px, z: pz, y: py }, 3.4) && Math.abs(g.player.x - px) < 0.4) },
        { x: px, z: pz + 1.4, r: 0.25, use: true, until: () => holder() === to },
      ];
      return [{ x: px + side * 1.7, z: pz + 1.4, r: 0.4, until: () => holder() === to }];
    };
    const seqSteps = () => (me === 'p1'
      ? []
      : []);
    void seqSteps; void me2; void take;
    const zPost = (id, z) => z;
    const stokerSteps = (F, stokerRole) => {
      const crosserRole = stokerRole === 'p1' ? 'p2' : 'p1';
      const fix = handover(-F.px, F.S.z0 - 4, F.S.y, stokerRole, crosserRole);        // if the stoker is holding the lantern (after a fall): hand it over first
      if (me === stokerRole) {
        return [
          ...fix,
          { x: F.px, z: F.S.z0 - 7.6, r: 0.5, until: () => holder() !== stokerRole && F.pad.pressed && F.br.up },   // hands free, then wait on the pad until the bridge is down...
          { x: F.px, z: F.S.z0 - 7.6, r: 0.5, until: () => F.relay.pressed && P.has && P.sz < F.S2.z0 - 1.5 },                   // ...and until the carrier is over and holding the far pad
          { x: 0, z: F.S2.zc, r: 1.5 },
        ];
      }
      return [
        ...fix,
        { x: 0, z: F.S.z1 + 1.2, r: 0.8, until: () => F.br.up },
        { x: 4.5, z: F.S2.z0 - 3, r: 0.6, until: () => P.has && P.sz < F.S2.z0 - 5 && Math.abs(P.sy - F.S2.y) < 1 },     // stand on the far pad until the stoker is across
        { x: 0, z: F.S2.zc, r: 1.5 },
      ];
    };
    const ffSteps = () => {
      if (me === 'p1') {
        const out = [];
        for (const k of seq) { const sx = FF[k].x < 0 ? -10.6 : 10.6; out.push({ x: sx, z: FF[k].z, r: 0.7 }, { x: FF[k].x, z: FF[k].z, r: 0.9 }, { x: sx, z: FF[k].z, r: 0.7 }, { x: 0, z: H.zc, r: 1.5 }); }
        out.push({ x: 0, z: H.z1 + 1.8, r: 1, until: () => gFF.passable }, { x: 0, z: H.z1 - 3, r: 1.5 });
        return out;
      }
      return [{ x: 0, z: H.zc, r: 1.5, until: () => c.get('ffs', { n: 0 }).n >= 3 && gFF.passable }];
    };
    const topSteps = () => {
      const upX = ts.x;
      if (me === 'p1') return [
        { x: upX, z: ts.z - 2.4, r: 0.5, until: () => last.up && relay2.zn.pressed && P.has && P.sz < tz1 - 10.5 },
        { x: upX, z: gzc, r: 1.5 },
      ];
      return [
        { x: upX, z: tz1 + 1.2, r: 0.8, until: () => last.up },
        { x: upX + 4.5, z: tz1 - 9 - 2.5, r: 0.6, until: () => P.has && P.sz < tz1 - 13.5 },
        { x: upX, z: gzc, r: 1.5 },
      ];
    };
    const fp = (v) => v;
    void fp; void zPost;
    const FIRST = { p1: 'p1', p2: 'p2' };
    void FIRST;
    // the sequence of holders: p1 takes it, hands to p2 at post 1, then p2 -> p1 at the S2 post, ... (see L.post ids)
    const sequence = [];
    // 1. camp: p1 picks up the lantern, p2 waits
    sequence.push(me === 'p1' ? [{ x: -0.5, z: -10.2, r: 0.3, use: true, until: () => holder() === 'p1' }] : [{ x: 0.5, z: -10.2, r: 0.4, until: () => holder() === 'p1' }]);
    // 2. trail to post 1, hand to p2 there
    sequence.push([{ follow: true, until: () => g.player.z < B1.z0 - 1 }]);
    sequence.push(handover(-4.5, B1.zc - 0.5, B1.y, 'p1', 'p2'));
    // 3. teal stones + the close bridge up to the first fire
    sequence.push([{ follow: true, until: () => g.player.z < F1.S.z0 - 3 }]);
    sequence.push(stokerSteps(F1, 'p1'));
    // 4. post on S2: p2 hands it to p1
    sequence.push(handover(-5.5, F1.S2.z0 - 8, F1.S2.y, 'p2', 'p1'));
    sequence.push([{ follow: true, until: () => g.player.z < F2.S.z0 - 3 }]);
    sequence.push(stokerSteps(F2, 'p2'));
    // 5. fireflies
    sequence.push([{ follow: true, until: () => g.player.z < H.z0 - 3 && g.player.z > H.z1 }]);
    sequence.push(ffSteps());
    // 6. relay: M0 nothing, leg A (p1 holds) -> post m1: p1 gives to p2 -> leg B -> post m2: p2 gives to p1 -> leg C -> toss
    sequence.push([{ follow: true, until: () => g.player.z < M1.z0 - 1 }]);
    sequence.push(handover(-4.5, M1.zc, M1.y, 'p1', 'p2'));
    sequence.push([{ follow: true, until: () => g.player.z < M2.z0 - 1 }]);
    sequence.push(handover(4.5, M2.zc, M2.y, 'p2', 'p1'));
    sequence.push([{ follow: true, until: () => g.player.z < M3.zc - 1 && g.player.z > M3.z1 }]);
    sequence.push(me === 'p1'
      ? [{ x: -0.6, z: padZ, r: 0.4, until: () => tossZ.active }, { x: -0.6, z: padZ, r: 0.4, use: true, until: () => holder() === 'post:far' }]
      : [{ x: 0.6, z: padZ, r: 0.4, until: () => holder() === 'post:far' }]);
    sequence.push([{ x: 0, z: F.z0 - 1, r: 1.2 }]);
    sequence.push(me === 'p1'
      ? [{ x: -5, z: F.z0 - 6, r: 0.3, use: true, until: () => L.mode === 'two' }]
      : [{ x: -3.6, z: F.z0 - 6, r: 0.4, until: () => L.mode === 'two' }]);
    // 7. summit
    sequence.push([{ follow: true, until: () => g.player.y > ytop - 0.5 && Math.hypot(g.player.x - ts.x, g.player.z - ts.z) < 4.8 }]);
    sequence.push(topSteps());
    sequence.push([{ follow: true }]);
    const flat = sequence.flat();
    botSteps(w, { p1: me === 'p1' ? flat : [], p2: me === 'p2' ? flat : [] });
    // leash: whoever is ahead on a plain walk waits for the other (keeps the bots inside the lantern's circle and inside 6 m)
    const basePlan = w.botPlan;
    let pp = null;
    const idxOf = (x, yy, z) => {
      pp = pp || w.plats.filter((q) => q.o.path === true);
      let best = 0, bd = 1e9;
      pp.forEach((q, i) => {
        const b = q.body, bx = q.base.x, bz = q.base.z, top = q.base.y + b.hy;
        const d = Math.hypot(Math.max(0, Math.abs(x - bx) - b.hx), Math.max(0, Math.abs(z - bz) - b.hz)) + Math.abs(yy - top) * 1.5;
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    };
    w.botPlan = (gg) => {
      const plan = basePlan(gg);
      if (plan || !P.has) return plan;
      const p = gg.player;
      const d = Math.hypot(P.sx - p.x, P.sz - p.z, (P.sy - p.y) * 0.6);
      if (L.mode === 'one' && d > 9 && L.holder() !== 'post:far') {          // somebody fell and respawned: the one with the light goes back, the other stays on solid ground
        const hh = L.holder();
        if (hh === me && idxOf(P.sx, P.sy, P.sz) < idxOf(p.x, p.y, p.z)) return { x: P.sx, z: P.sz };
        if (hh !== me) return { x: p.x, z: p.z, wait: true };
      }
      if (d > 4.2) {
        const a = idxOf(p.x, p.y, p.z), b = idxOf(P.sx, P.sy, P.sz);
        if (a > b || (a === b && p.z < P.sz)) return { x: p.x, z: p.z, wait: true };
      }
      return null;
    };
  },
};
