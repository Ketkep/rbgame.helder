import * as THREE from 'three';
import { Body, MOVE, playerTouches } from '../engine/physics.js';

// Campaign 3 netcode + shared-world layer.
//
// Model: every browser simulates its OWN player locally (so you never feel lag on yourself) and runs the whole level locally.
// Everything that is a function of the world clock (movers, blinking lasers, …) stays in step because both clocks are
// aligned at "go" and nudged by the host a few times a second. What crosses the wire:
//   p   – your position/velocity/look (20 Hz) -> the partner avatar, which is also a solid body in the other world
//   st  – shared state keys (last writer wins, host breaks ties)      ev – one-shot events        pr – presence flags
//   die / rev / cp / done / shove / load / loaded / go / clk / ping / pong / hello / say
//
// Levels talk to it through `w.coop` (see `api()` below and docs/campaign3-coop.md).

export const ROLES = {
  p1: { label: 'Player 1', color: 0xff9a3d, css: '#ff9a3d' },
  p2: { label: 'Player 2', color: 0x39d7c9, css: '#39d7c9' },
};
const SEND_EVERY = 1 / 20;
const REVIVE_RANGE = 2.4, REVIVE_HOLD = 1.1, REVIVE_TIMEOUT = 25;

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export class Coop {
  constructor(game, link, isHost, name = '') {
    this.game = game; this.link = link; this.isHost = isHost;
    this.me = isHost ? 'p1' : 'p2'; this.other = isHost ? 'p2' : 'p1';
    this.names = { p1: ROLES.p1.label, p2: ROLES.p2.label };
    this.names[this.me] = (name || '').trim().slice(0, 14) || ROLES[this.me].label;
    this.connected = false; this.helloed = false;
    this.rtt = 0.06; this.pingAt = 0; this._pingT = 0;
    this.onevent = null;         // UI callbacks: (type, data)
    this.partner = { has: false, x: 0, y: -999, z: 0, sx: 0, sy: -999, sz: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, g: true, dead: false, recvAt: 0, snap: true };
    this.pfeet = this.partner;   // alias: something with x/y/z at the partner's feet (for playerTouches)
    this.waitingGo = false; this.levelSeed = 0; this.levelIdx = -1;
    this._sendT = 0; this._clkT = 0; this._shoveCd = 0;
    this.revive = { downAt: null, progress: 0, waited: 0, target: null };
    this._wired();
    this._timer = setInterval(() => this._sendPos(), SEND_EVERY * 1000);     // an interval, not rAF: a covered window keeps talking
  }

  _sendPos() {
    const g = this.game, p = g.player;
    if (!this.connected || !g.world || g.state === 'coopwait' || g.state === 'title') return;
    const r = (v, n = 2) => +v.toFixed(n);
    this.send({ t: 'p', x: r(p.x), y: r(p.y), z: r(p.z), vx: r(p.vx, 1), vy: r(p.vy, 1), vz: r(p.vz, 1), yaw: r(g.yaw), pitch: r(g.pitch), g: p.grounded ? 1 : 0, d: g.state === 'dead' ? 1 : 0 });
  }

  get rule() { return this.world?.coopRules?.deathRule || this.game.level?.deathRule || 'self'; }
  get world() { return this.game.world; }

  // ------------------------------------------------------------------ link ------------------
  _wired() {
    const l = this.link;
    l.onmessage = (m) => this._recv(m);
    l.onclose = () => { this.connected = false; this.onevent?.('closed'); this.game.onCoopClosed?.(); };
    const up = () => { this.connected = true; this.send({ t: 'hello', name: this.names[this.me], v: 1 }); this.onevent?.('open'); };
    if (l.open) up(); else l.onopen = up;
  }
  send(m) { this.link.send(m); }
  close() { clearInterval(this._timer); try { this.send({ t: 'bye' }); this.link.close(); } catch { /* */ } this.connected = false; }

  _recv(m) {
    if (!m || typeof m !== 'object') return;
    const g = this.game;
    switch (m.t) {
      case 'hello': this.helloed = true; this.names[this.other] = String(m.name || ROLES[this.other].label).slice(0, 14); this.onevent?.('hello'); break;
      case 'ping': this.send({ t: 'pong', at: m.at }); break;
      case 'pong': this.rtt = this.rtt * 0.7 + Math.max(0.001, (performance.now() - m.at) / 1000) * 0.3; this.onevent?.('rtt'); break;
      case 'p': this._recvPos(m); break;
      case 'st': this._recvState(m); break;
      case 'ev': this._fire(this._ev, m.n, m.a, true); break;
      case 'pr': this._recvPresence(m); break;
      case 'cp': this._recvCheckpoint(m); break;
      case 'die': this._recvDie(m); break;
      case 'rev': this.revive.target = { x: m.x, y: m.y, z: m.z }; this.revive.granted = true; break;
      case 'shove': if ((this.world?.coopRules?.shove ?? 1) > 0 && g.state === 'playing') { g.player.vx += m.vx; g.player.vz += m.vz; g.player.grounded = false; g.player.ground = null; } break;
      case 'done': if (g.state === 'playing') g.completeLevel(); break;
      case 'load': g.coopLoad(m.i, m.seed).then(() => this.send({ t: 'loaded' })); break;
      case 'loaded': this._partnerLoaded = true; this._maybeGo(); break;
      case 'go': g.coopBegin(m.rtt ?? this.rtt); break;
      case 'clk': this._recvClock(m); break;
      case 'say': g.narrator.say(m.k, { priority: m.p ?? 1 }); break;
      case 'menu': this.onevent?.('menu', m); break;                 // host -> joiner: back to the room screen
      case 'bye': this.onevent?.('bye'); break;
      default: break;
    }
  }

  // ------------------------------------------------------------------ level lifecycle -------
  /** Host: load level i on both sides, then start together. */
  startLevel(i) {
    if (!this.isHost) return;
    const seed = (Math.random() * 2 ** 31) | 0;
    this._partnerLoaded = false; this._myLoaded = false;
    this.send({ t: 'load', i, seed });
    this.game.coopLoad(i, seed).then(() => { this._myLoaded = true; this._maybeGo(); });
  }
  _maybeGo() {
    if (!this.isHost || !this._partnerLoaded || !this._myLoaded) return;
    this._partnerLoaded = this._myLoaded = false;
    this.send({ t: 'go', rtt: this.rtt });
    this.game.coopBegin(0);
  }

  /** Called by Game before level.build(): makes the partner's avatar + body and gives the level its API. */
  attachWorld(w, seed) {
    this.levelSeed = seed;
    this._rng = mulberry32(seed);
    this.store = new Map(); this._st = {}; this._ev = {}; this._pres = { p1: {}, p2: {} };
    this.zones = [];
    this._tether = null; this._presH = {};
    this.revive = { downAt: null, progress: 0, waited: 0, target: null };
    this.partner.snap = true;
    // the partner is a solid body in this world (stand on their head, block their way)
    const body = (this.body = new Body(0, -999, 0, MOVE.halfW, MOVE.height / 2, MOVE.halfW));
    body.tag = 'partner'; body.enabled = false;
    w.bodies.push(body);
    this._buildAvatar(w);
    w.coop = this.api(w);
    w.coopRules = { shove: 1, resetOnRespawn: false };
    w.updaters.push((dt) => this._substep(dt));
    w.disposers.push(() => { this.rope = null; });
  }

  _buildAvatar(w) {
    const col = ROLES[this.other].color;
    const g = (this.avatar = new THREE.Group());
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: 0.1, emissive: col, emissiveIntensity: 0.12 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.8, 6, 14), mat); body.position.y = 0.85; body.castShadow = true; g.add(body);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.17, 0.3), new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 0.2, metalness: 0.6, emissive: 0x9fe8ff, emissiveIntensity: 0.25 }));
    visor.position.set(0, 1.28, -0.2); g.add(visor);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    lamp.position.set(0, 1.62, 0); g.add(lamp);
    // name tag
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    this._tagCanvas = c; this._tagTex = new THREE.CanvasTexture(c); this._tagTex.colorSpace = THREE.SRGBColorSpace;
    this._drawTag();
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._tagTex, transparent: true, depthTest: false, toneMapped: false }));
    tag.scale.set(1.5, 0.375, 1); tag.position.y = 2.15; tag.renderOrder = 20; g.add(tag);
    this.tag = tag;
    // "downed" marker for the revive rule
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: 0xff4d5e, toneMapped: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; ring.visible = false; g.add(ring);
    this.downRing = ring;
    g.visible = false;
    w.scene.add(g);
    this.mats = [mat, visor.material];
    w.disposers.push(() => { this._tagTex.dispose(); mat.dispose(); });
  }
  _drawTag() {
    const c = this._tagCanvas, x = c.getContext('2d');
    x.clearRect(0, 0, 256, 64);
    x.fillStyle = 'rgba(10,12,20,0.7)'; x.beginPath(); x.roundRect(4, 8, 248, 48, 22); x.fill();
    x.fillStyle = ROLES[this.other].css; x.beginPath(); x.arc(30, 32, 10, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.font = '700 26px Inter, system-ui, sans-serif'; x.textBaseline = 'middle'; x.fillText(this.names[this.other], 50, 33);
    this._tagTex.needsUpdate = true;
  }
  refreshTag() { if (this._tagCanvas) this._drawTag(); }

  // ------------------------------------------------------------------ position stream -------
  _recvPos(m) {
    const P = this.partner;
    P.x = m.x; P.y = m.y; P.z = m.z; P.vx = m.vx; P.vy = m.vy; P.vz = m.vz; P.yaw = m.yaw; P.pitch = m.pitch; P.g = !!m.g;
    const wasDead = P.dead; P.dead = !!m.d;
    P.recvAt = performance.now();
    if (!P.has || P.snap || wasDead !== P.dead) { P.sx = P.x; P.sy = P.y; P.sz = P.z; P.has = true; P.snap = false; }
    if (!P.dead && wasDead) this.revive.downAt = null;
  }

  /** Per world substep (so a partner you stand on carries you smoothly). */
  _substep(h) {
    const P = this.partner, b = this.body;
    if (!P.has) { b.enabled = false; return; }
    const age = Math.min(0.2, (performance.now() - P.recvAt) / 1000);
    const tx = P.x + P.vx * age, tz = P.z + P.vz * age;
    const ty = P.g ? P.y : P.y + P.vy * age;
    const jump = Math.hypot(tx - P.sx, tz - P.sz) > 5 || Math.abs(ty - P.sy) > 8;
    const k = jump ? 1 : 1 - Math.exp(-h * 20);
    P.sx += (tx - P.sx) * k; P.sy += (ty - P.sy) * k; P.sz += (tz - P.sz) * k;
    b.enabled = !P.dead;
    b.setCenter(P.sx, P.sy + MOVE.height / 2, P.sz);
    // never pop the solid body into the local player; stay ghostly until you are apart
    const me = this.game.player;
    b.solid = !(this.world?.coopRules?.ghost) && !playerTouches(me, b, 0.1);
    for (const z of this.zones) this._zoneStep(z);
    if (this._tether) this._tetherStep(h);
  }

  update(dt) {
    const g = this.game, p = g.player, P = this.partner;
    this._pingT += dt;
    if (this._pingT > 1.5) { this._pingT = 0; this.send({ t: 'ping', at: performance.now() }); }
    this._shoveCd = Math.max(0, this._shoveCd - dt);
    // host keeps the world clocks together
    if (this.isHost && g.state === 'playing') { this._clkT += dt; if (this._clkT > 2.5) { this._clkT = 0; this.send({ t: 'clk', w: g.world.t }); } }
    // avatar
    const av = this.avatar;
    if (av) {
      av.visible = P.has;
      if (P.has) {
        av.position.set(P.sx, P.sy, P.sz);
        const sp = Math.hypot(P.vx, P.vz);
        const targetYaw = sp > 0.5 ? Math.atan2(-P.vx, -P.vz) : P.yaw;
        av.rotation.y += angDiff(av.rotation.y, targetYaw) * Math.min(1, dt * 10);
        av.children[0].rotation.x = Math.min(0.3, sp * 0.03) * (P.g ? 1 : 0.4);
        av.children[0].scale.y = P.dead ? 0.35 : 1;
        av.children[1].visible = !P.dead;
        this.tag.material.opacity = P.dead ? 0.55 : 1;
        this.downRing.visible = P.dead && this.rule === 'revive';
        const d = Math.hypot(P.sx - p.x, P.sz - p.z);
        this.tag.visible = d > 1.2;
        this.tag.position.y = 2.15 + Math.min(1.2, d * 0.02);
        this.tag.scale.setScalar(1 + Math.min(1.5, d * 0.02));
      }
    }
    this._updateRope();
    this._updateShove(dt);
    this._updateRevive(dt);
    // clock slew (joiner)
    if (this._clkErr && g.world) { const s = this._clkErr * Math.min(1, dt * 4); g.world.t += s; this._clkErr -= s; if (Math.abs(this._clkErr) < 0.002) this._clkErr = 0; }
  }

  _recvClock(m) {
    if (this.isHost || !this.world) return;
    const err = m.w + this.rtt / 2 - this.world.t;
    this._clkErr = Math.abs(err) > 0.02 ? Math.max(-0.5, Math.min(0.5, err)) : 0;
    if (Math.abs(err) > 1.5) { this.world.t += err; this._clkErr = 0; }
  }

  _updateShove() {
    const g = this.game, p = g.player, P = this.partner;
    if (g.state !== 'playing' || !P.has || P.dead || this._shoveCd > 0) return;
    const rules = this.world.coopRules; if (!rules.shove) return;
    const dx = P.sx - p.x, dz = P.sz - p.z, d = Math.hypot(dx, dz);
    if (d > 0.9 || d < 0.01 || Math.abs(P.sy - p.y) > 1.3) return;
    const w = g._wish(); if (!w.any) return;
    const toward = (w.wx * dx + w.wz * dz) / d;
    if (toward < 0.7) return;
    this._shoveCd = 0.5;
    const s = 4.2 * rules.shove;
    this.send({ t: 'shove', vx: +(dx / d * s).toFixed(2), vz: +(dz / d * s).toFixed(2) });
  }

  // ------------------------------------------------------------------ shared state ----------
  _recvState(m) {
    const cur = this.store.get(m.k);
    if (cur && (cur.ver > m.ver || (cur.ver === m.ver && this.isHost))) return;        // newer wins; host wins ties
    this.store.set(m.k, { v: m.v, ver: m.ver });
    this._fire(this._st, m.k, m.v, true);
  }
  _fire(table, k, v, remote) { for (const f of table[k] || []) f(v, remote); }

  _recvPresence(m) { this._pres[this.other][m.k] = !!m.v; this._presChanged(m.k); }
  setPresence(k, v) {
    if (this._pres[this.me][k] === !!v) return;
    this._pres[this.me][k] = !!v; this.send({ t: 'pr', k, v: v ? 1 : 0 }); this._presChanged(k);
  }
  _presChanged(k) {
    const both = this._pres.p1[k] && this._pres.p2[k];
    for (const f of this._presH[k] || []) f(both, this._pres);
  }

  // ------------------------------------------------------------------ checkpoints / death / finish
  onCheckpoint(cp) {
    const i = this.world.checkpoints.indexOf(cp);
    if (i >= 0) this.send({ t: 'cp', i });
  }
  _recvCheckpoint(m) {
    const w = this.world, cp = w?.checkpoints[m.i];
    if (!cp || cp.used) return;
    cp.used = true;
    w.burst(new THREE.Vector3(cp.x, cp.y + 0.4, cp.z), 0xffc83d, 24);
    if (cp.real) { w.respawn = { x: cp.x, y: cp.y, z: cp.z, yaw: this.game.yaw }; this.game.audio.checkpoint(); this.game.ui.toast(`✔ ${this.names[this.other]} saved the checkpoint`, 'gold'); }
    w.hooks.onCheckpoint?.(cp);
  }

  onLocalDeath(reason, fromPartner) {
    this.revive.waited = 0; this.revive.granted = false; this.revive.target = null;
    if (!fromPartner) this.send({ t: 'die', r: String(reason) });
  }
  _recvDie(m) {
    const g = this.game;
    if (g.state !== 'playing') return;
    const n = this.names[this.other];
    if (this.rule === 'both') { g.ui.toast(`${n} fell — you both go back`, 'bad'); g.kill('partner', true); }
    else if (this.rule === 'revive') g.ui.toast(`${n} is down! Stand next to them to pull them up`, 'bad');
    else g.ui.toast(`${n} fell`, 'bad');
    this.revive.downAt = { x: this.partner.x, y: this.partner.y, z: this.partner.z };
    this.world.hooks.onPartnerDeath?.(m.r);
  }

  /** While true the dead local player stays down (revive rule). */
  holdDead(deadT) {
    if (this.rule !== 'revive' || this.partner.dead || !this.connected) return false;
    if (this.revive.granted) return false;
    return deadT < REVIVE_TIMEOUT;
  }
  /** Where to respawn: next to the partner who revived us, else the checkpoint. */
  consumeReviveTarget() { const t = this.revive.target; this.revive.target = null; this.revive.granted = false; return t; }

  _updateRevive(dt) {
    const g = this.game, P = this.partner;
    if (this.rule !== 'revive' || g.state !== 'playing' || !P.has || !P.dead) { this.revive.progress = 0; return; }
    const p = g.player;
    const near = Math.hypot(P.x - p.x, P.z - p.z) < REVIVE_RANGE && Math.abs(P.y - p.y) < 2.5;
    this.revive.progress = near ? this.revive.progress + dt : Math.max(0, this.revive.progress - dt * 2);
    if (this.downRing) { this.downRing.material.color.setHex(near ? 0x3ddc97 : 0xff4d5e); this.downRing.scale.setScalar(1 + Math.sin(performance.now() / 200) * 0.06 + this.revive.progress * 0.2); }
    if (this.revive.progress > REVIVE_HOLD) {
      this.revive.progress = 0;
      this.send({ t: 'rev', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) });
      g.ui.toast(`You pulled ${this.names[this.other]} up`, 'good');
    }
  }

  finish() {
    const g = this.game;
    if (g.state !== 'playing' || g.world.completed) return;
    this.send({ t: 'done' });
    g.completeLevel();
  }

  /** Is the partner standing on this body? (so crumbling/rolling platforms react to them too) */
  partnerOn(body) {
    const P = this.partner;
    if (!P.has || P.dead || !P.g) return false;
    return Math.abs(P.sx - body.x) <= body.hx + 0.3 && Math.abs(P.sz - body.z) <= body.hz + 0.3 && Math.abs(P.sy - (body.y + body.hy)) < 0.12;
  }

  // ------------------------------------------------------------------ zones ------------------
  _zoneStep(z) {
    const g = this.game, P = this.partner;
    const mine = g.state === 'playing' && playerTouches(g.player, z.body, z.shrink);
    const theirs = P.has && !P.dead && playerTouches({ x: P.sx, y: P.sy, z: P.sz }, z.body, z.shrink);
    const occ = { p1: this.me === 'p1' ? mine : theirs, p2: this.me === 'p2' ? mine : theirs };
    const need = z.need;
    const active = need === 'both' ? occ.p1 && occ.p2 : need === 'any' ? occ.p1 || occ.p2 : occ[need];
    const changed = active !== z.active || occ.p1 !== z.p1 || occ.p2 !== z.p2;
    z.p1 = occ.p1; z.p2 = occ.p2; z.mine = mine; z.theirs = theirs; z.count = (occ.p1 ? 1 : 0) + (occ.p2 ? 1 : 0);
    if (changed) { const was = z.active; z.active = active; for (const f of z.handlers) f(z, was); }
  }

  // ------------------------------------------------------------------ tether ----------------
  _tetherStep(h) {
    const T = this._tether, g = this.game, p = g.player, P = this.partner;
    if (!T.on || g.state !== 'playing' || !P.has || P.dead) return;
    const dx = P.sx - p.x, dy = (P.sy - p.y) * 0.5, dz = P.sz - p.z, d = Math.hypot(dx, dy, dz);
    if (d <= T.max) return;
    const pull = Math.min(T.k * (d - T.max), 40) * h;
    p.vx += (dx / d) * pull; p.vz += (dz / d) * pull;
    if (p.vy < 6) p.vy += (dy / d) * pull * 0.6;
    const damp = Math.max(0, 1 - 2.2 * h);   // stop the rope from slingshotting
    p.vx *= damp; p.vz *= damp;
  }
  _updateRope() {
    const T = this._tether, w = this.world;
    if (!T || !T.on || !T.rope || !w || !this.partner.has) { if (this.rope) this.rope.visible = false; return; }
    if (!this.rope) {
      const n = 14, pos = new Float32Array(n * 3);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rope = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, linewidth: 2 }));
      this.rope.frustumCulled = false; w.scene.add(this.rope); this.ropeN = n;
      w.disposers.push(() => { geo.dispose(); });
    }
    const p = this.game.player, P = this.partner, n = this.ropeN, a = this.rope.geometry.attributes.position;
    const ax = p.x, ay = p.y + 1.0, az = p.z, bx = P.sx, by = P.sy + 1.0, bz = P.sz;
    const d = Math.hypot(bx - ax, by - ay, bz - az), slack = Math.max(0, T.max - d) * 0.6 + 0.2;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      a.setXYZ(i, ax + (bx - ax) * t, ay + (by - ay) * t - Math.sin(t * Math.PI) * slack, az + (bz - az) * t);
    }
    a.needsUpdate = true; this.rope.visible = true;
    const stretch = Math.max(0, (d - T.max) / T.max);
    this.rope.material.color.setHex(stretch > 0.05 ? 0xff7b6b : 0xffe9a8);
  }

  // ------------------------------------------------------------------ level-facing API -------
  api(w) {
    const c = this;
    return {
      me: c.me, other: c.other, isHost: c.isHost, names: c.names, roles: ROLES,
      get partner() { return c.partner; },
      get connected() { return c.connected; },
      partnerOn: (b) => c.partnerOn(b),
      get rtt() { return c.rtt; },
      /** seeded random shared by both players (same sequence on both machines as long as both call it in the same order) */
      rand: () => c._rng(),
      /** a stream that depends only on `salt`, so call order doesn't matter */
      rng: (salt = 0) => mulberry32((c.levelSeed ^ Math.imul(salt + 1, 0x9e3779b1)) | 0),
      /** shared key/value store; handlers get (value, fromPartner) */
      set(k, v) { const cur = c.store.get(k); const ver = (cur?.ver || 0) + 1; c.store.set(k, { v, ver }); c.send({ t: 'st', k, v, ver }); c._fire(c._st, k, v, false); },
      get(k, d) { const e = c.store.get(k); return e ? e.v : d; },
      on(k, f) { (c._st[k] ||= []).push(f); },
      /** one-shot event that fires on BOTH machines (here immediately, there on arrival) */
      emit(n, a) { c.send({ t: 'ev', n, a }); c._fire(c._ev, n, a, false); },
      onEvent(n, f) { (c._ev[n] ||= []).push(f); },
      /** per-player flags ("I'm standing at the goal"); handler gets (bothTrue) */
      presence: (k, v) => c.setPresence(k, v),
      onPresence(k, f) { (c._presH[k] ||= []).push(f); },
      presenceOf: (role, k) => !!c._pres[role][k],
      /** is this machine the given role? */
      is: (r) => r === c.me || r === 'all',
      /** narrator line only for one role (or 'all') */
      tell(role, key, opts) { if (role === 'all' || role === c.me) c.game.narrator.say(key, opts); },
      /** ask the partner to show a narrator line */
      sayPartner(key, p = 1) { c.send({ t: 'say', k: key, p }); },
      /** an invisible volume that knows who is inside. need: 'any' | 'both' | 'p1' | 'p2' */
      zone(o) {
        const { x = 0, y = 0, z = 0, w: ww = 2, h = 2, d = 2, need = 'any', shrink = 0.05 } = o;
        const body = new Body(x, y, z, ww / 2, h / 2, d / 2); body.solid = false;
        const zn = { body, need, shrink, active: false, p1: false, p2: false, mine: false, theirs: false, count: 0, handlers: [], onChange(f) { zn.handlers.push(f); return zn; } };
        c.zones.push(zn); return zn;
      },
      /** both players must be inside to finish the level */
      tether(o = {}) { c._tether = { max: 9, k: 14, rope: true, on: true, ...o }; return c._tether; },
      finish: () => c.finish(),
      setShove(v) { w.coopRules.shove = v; },
      get rules() { return w.coopRules; },
    };
  }
}

function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
