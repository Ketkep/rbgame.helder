import * as THREE from 'three';
import { glowMaterial, plainMaterial } from '../../engine/materials.js';
import { inView } from '../../engine/view.js';
import { GOLD } from './kit.js';

// The hotel's troll kit: the tricks the redone levels share, so they all behave (and are tested) the same way.
//
//  fakeComplete       a convincing "LEVEL COMPLETE" screen that turns out to be a lie            (once per level)
//  fakeExit           a glowing exit that is not one (a door or a goal ring)
//  evasiveGoal        a real goal that scoots away as you reach for it
//  checkpoint tricks  trollCheckpoint(): 'fake' (never saves), 'expire' (saves, then forgets) or 'rewind' (saves you... back there)
//  twist              control mutators for a few seconds: A/D, W/S, mouse X, mouse Y, jump lag. Always announced, always reverted.
//  crash / adBreak / loadingScreen / survey   fake interface moments
//  vanishAfter / ghostPlat / lookAwayFlip     floors that lie
//  stageTitle / stageHint                      pacing: a banner for each stage, and a hint that only leads to the next one
//
// Rules every trick follows (the user asked for this): LEARNABLE (there is a tell, or the host is too confident), never permanent,
// and Baby Mode takes the sting out (fake checkpoints count, twists are short, decoy exits are labelled).

const BABY_TWIST = 3.5;

function state(w) {
  if (w._troll) return w._troll;
  const st = (w._troll = { twist: null, exp: null, timers: new Set(), fakeDone: false, overlay: null, flips: [], unfreeze: false });
  w.onUpdate((dt) => {
    // control twists wear off on their own (in world time, so a frozen game does not tick them down)
    if (st.twist && w.t >= st.twist.until) untwist(w.game, w, { quiet: false });
    // an expiring checkpoint forgets itself
    if (st.exp && w.t >= st.exp.until) {
      const e = st.exp; st.exp = null;
      if (Math.hypot(w.respawn.x - e.cp.x, w.respawn.z - e.cp.z) < 0.5) {
        w.respawn = { ...e.prev };
        w.game.ui.toast('✖ Checkpoint expired', 'bad'); w.game.audio.glitch();
        e.cp.ring.material.color.setScalar(0.25); e.cp.flag.material.color.setScalar(0.5); e.cp.used = false;      // touch it again and it saves again
        if (e.say) w.game.say(e.say, { priority: 1 });
      }
    }
    for (const f of st.flips) f(dt);
  });
  w.onRespawn(() => { clearLater(st); hideOverlays(w); if (st.twist) untwist(w.game, w, { quiet: true }); });
  w.onDispose(() => { clearLater(st); hideOverlays(w); });
  return st;
}

/** A real-time timer that dies with the level / the attempt (world time stops while the game is frozen, real time does not). */
function later(w, ms, fn) {
  const st = state(w);
  const id = setTimeout(() => { st.timers.delete(id); fn(); }, ms);
  st.timers.add(id);
  return id;
}
function clearLater(st) { for (const id of st.timers) clearTimeout(id); st.timers.clear(); }
function hideOverlays(w) {
  const st = w._troll, g = w.game;
  if (!st) return;
  st.overlay?.remove(); st.overlay = null;
  if (st.unfreeze) { g.frozen = false; st.unfreeze = false; g.last = performance.now(); }
  g.ui.bars(false); g.ui.ad(false); g.ui.loading(false); g.ui.glitch(false);
  if (g.modal?.troll) g.closeModal();
  document.getElementById('stagetitle')?.classList.remove('go');
}
function freeze(w) { const st = state(w); w.game.frozen = true; st.unfreeze = true; }
function thaw(w) { const st = state(w); if (st.unfreeze) { w.game.frozen = false; st.unfreeze = false; w.game.last = performance.now(); } }

// ================================================================================================
//  Control twists
// ================================================================================================
const TWISTS = {
  swap: { set: (m) => { m.swapStrafe = true; }, off: (m) => { m.swapStrafe = false; }, text: 'PATCH 4.0.1 — A ⇄ D swapped (nobody asked)' },
  fwd: { set: (m) => { m.swapFwd = true; }, off: (m) => { m.swapFwd = false; }, text: 'PATCH 4.0.2 — W ⇄ S swapped (still nobody asked)' },
  mouseX: { set: (m) => { m.invertX = true; }, off: (m) => { m.invertX = false; }, text: 'MIRROR MODE: look left, turn right. It is a feature.' },
  mouseY: { set: (m) => { m.invertY = true; }, off: (m) => { m.invertY = false; }, text: 'INVERTED LOOK enabled. For your comfort.' },
  lag: { set: (m) => { m.jumpLag = 0.28; }, off: (m) => { m.jumpLag = 0; }, text: 'INPUT LAG: jumps now arrive when they feel like it' },
};

/**
 * Mutate the controls for `sec` seconds (3.5 in Baby Mode at most). `kind`: swap | fwd | mouseX | mouseY | lag.
 * Announces itself with a toast (and the host, if you pass `say`) and always gives the controls back.
 */
export function twist(game, w, kind, { sec = 8, say = null } = {}) {
  const st = state(w), def = TWISTS[kind];
  if (!def) return;
  if (st.twist) untwist(game, w, { quiet: true });
  def.set(game.mods);
  st.twist = { kind, until: w.t + (game.baby ? Math.min(sec, BABY_TWIST) : sec) };
  game.ui.toast(def.text, 'bad'); game.audio.glitch();
  if (say) game.say(say, { priority: 2 });
}
export function untwist(game, w, { quiet = false } = {}) {
  const st = state(w);
  if (!st.twist) return;
  TWISTS[st.twist.kind].off(game.mods);
  st.twist = null;
  if (!quiet) game.ui.toast('Controls restored', 'good');
}
/** Walk into the box and the twist starts (it is cancelled again by respawning). */
export function twistZone(game, w, box, kind, opts = {}) {
  return w.trigger({ ...box, once: true, resetOnRespawn: true, onEnter: () => twist(game, w, kind, opts) });
}

// ================================================================================================
//  Fake interface moments
// ================================================================================================
const LOAD_TIPS = ['Reticulating splines', 'Polishing the brass', 'Warming up the lies', 'Asking housekeeping', 'Calculating your tip', 'Almost there (we say that a lot)', 'Pretending to load'];

/** The screen goes grey, the world freezes, and a very serious bar fills. */
export function loadingScreen(game, w, { sec = 2.2, say = null, sayAfter = null } = {}) {
  const ui = game.ui;
  freeze(w); ui.loading(true); ui.setLoading(0, LOAD_TIPS[0]);
  if (say) game.say(say, { priority: 2 });
  const t0 = performance.now(), len = (game.baby ? Math.min(sec, 1.4) : sec) * 1000;
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / len);
    ui.setLoading(k * 100 * (0.82 + Math.random() * 0.18), LOAD_TIPS[Math.floor((performance.now() - t0) / 380) % LOAD_TIPS.length]);
    if (k < 1) later(w, 90, tick);
    else { ui.loading(false); thaw(w); if (sayAfter) game.say(sayAfter, { priority: 1 }); }
  };
  tick();
}

/** Colour bars: PLEASE STAND BY. The world freezes for `sec` seconds. */
export function crash(game, w, { sec = 3, say = null, sayAfter = null } = {}) {
  const ui = game.ui;
  freeze(w); ui.bars(true); game.audio.beep(1.4);
  if (say) game.say(say, { priority: 2 });
  later(w, (game.baby ? Math.min(sec, 2) : sec) * 1000, () => { ui.bars(false); thaw(w); if (sayAfter) game.say(sayAfter, { priority: 2 }); });
}

/** A full-screen ad with a countdown that does not freeze the game (so only use it where standing still is safe, or on a safe stretch). */
export function adBreak(game, w, { sec = 5, say = null, sayAfter = null } = {}) {
  const ui = game.ui, n = game.baby ? Math.min(sec, 3) : sec;
  ui.ad(true); ui.setAdSeconds(n);
  if (say) game.say(say, { priority: 2 });
  for (let s = n - 1; s >= 0; s--) later(w, (n - s) * 1000, () => { ui.setAdSeconds(s); if (s === 0) { ui.ad(false); if (sayAfter) game.say(sayAfter, { priority: 1 }); } });
}

/** "How are we doing?" Press 1-5. Escape does nothing. (Needs the player to be standing somewhere safe.) */
export function survey(game, w, { title = 'HOW ARE WE DOING?', lines = ['Rate your stay: 1 – 5', 'There is no 0. We checked.'], thanks = 'Thank you! Your feedback has been forwarded to the bin.', say = null } = {}) {
  const el = game.ui.el, st = state(w);
  el['panel-title'].textContent = title;
  el['panel-body'].innerHTML = '<div class="kp-msg" style="font-size:20px;line-height:1.5"></div><div class="kp-display survey-stars"></div>';
  el['panel-body'].querySelector('.kp-msg').innerHTML = lines.join('<br>');
  const stars = el['panel-body'].querySelector('.survey-stars');
  for (let i = 1; i <= 5; i++) { const d = document.createElement('div'); d.className = 'kp-digit'; d.textContent = '★'; d.title = String(i); stars.appendChild(d); stars.children[i - 1].addEventListener('click', () => done(i)); }
  el['panel-foot'].innerHTML = '<kbd>1</kbd>–<kbd>5</kbd> rate &nbsp; (<kbd>Esc</kbd> is for guests who like their stay)';
  game.keys.clear();
  let closed = false;
  const done = (n) => {
    if (closed) return; closed = true;
    el.panel.classList.add('hidden'); if (game.modal === modal) game.modal = null;
    game.ui.toast(`★ ${n}/5 — ${thanks}`, 'gold'); game.audio.chime();
  };
  const modal = {
    troll: true,
    key(e) { const m = /^(?:Digit|Numpad)([1-5])$/.exec(e.code); if (m) done(+m[1]); else if (e.code === 'Escape' || e.code === 'KeyE') game.ui.toast('Escape is not an option on this survey', 'bad'); },
    close() { if (closed) return; closed = true; el.panel.classList.add('hidden'); if (game.modal === modal) game.modal = null; },
  };
  game.modal = modal; el.panel.classList.remove('hidden'); void st;
  if (say) game.say(say, { priority: 2 });
}

/** A fake "LEVEL COMPLETE". Returns true if it played (once per level load); false means "this time it is real, complete the level yourself". */
export function fakeComplete(game, w, { title = 'LEVEL COMPLETE', sub = null, jk = '…JUST KIDDING', say = null, sayAfter = null, sec = 2.6, then = null } = {}) {
  const st = state(w);
  if (st.fakeDone) return false;
  st.fakeDone = true;
  freeze(w);
  const box = document.createElement('div');
  box.className = 'fakewin';
  box.innerHTML = `<div class="fw-card"><small>${(w.game.level?.name || 'LEVEL').toUpperCase()}</small><h2></h2><div class="fw-stars">★ ★ ★</div><p></p><div class="fw-btn">NEXT ▶</div></div>`;
  box.querySelector('h2').textContent = title;
  box.querySelector('p').textContent = sub ?? `Deaths ${game.deaths} · Time ${Math.floor(game.time / 60)}:${String(Math.floor(game.time % 60)).padStart(2, '0')}`;
  document.getElementById('app').appendChild(box);
  st.overlay = box;
  game.audio.levelComplete();
  if (say) game.say(say, { priority: 2 });
  const len = (game.baby ? Math.min(sec, 1.6) : sec) * 1000;
  if (game.baby) box.querySelector('h2').textContent = title + '*';
  later(w, len, () => {
    box.classList.add('lie'); box.querySelector('h2').textContent = jk; box.querySelector('.fw-stars').textContent = '✖ ✖ ✖';
    game.audio.glitch(); game.ui.glitch(true);
    later(w, 900, () => { game.ui.glitch(false); box.remove(); st.overlay = null; thaw(w); if (sayAfter) game.say(sayAfter, { priority: 2 }); then?.(); });
  });
  return true;
}

// ================================================================================================
//  Fake exits and evasive goals
// ================================================================================================
/**
 * A glowing exit that is not one. `kind` 'goal' (a ring you walk into; orange in Baby Mode) or 'door' (an art-deco door you press E on:
 * it swings open on a broom closet with no floor). Reaching/using it calls `onTouch(game)` (default: it kills you, with `say`).
 * It never touches `w.goalObj`, so the bot and the hint still find the real goal.
 */
export function fakeExit(w, game, { x, y = 0, z, yaw = 0, kind = 'goal', label = 'EXIT', color = 0x2dd4bf, onTouch = null, say = null, reason = 'fake', use = kind === 'door' } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw;
  const baby = game.baby;
  let leaf = null;
  if (kind === 'goal') {
    const c = baby ? 0xff8a5a : color;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 12, 48), glowMaterial(c, 2.0)); ring.position.y = 1.9; g.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(c), transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); disc.position.y = 1.9; g.add(disc);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.18, 32), plainMaterial(0x1c1d28, { metalness: 0.5, roughness: 0.35 })); base.position.y = 0.09; g.add(base);
    w.onUpdate((dt) => { ring.rotation.z += dt * 0.8; });
  } else {
    const frame = plainMaterial(GOLD, { metalness: 1, roughness: 0.3 });
    for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.4, 0.4), frame); post.position.set(sx * 1.25, 2.2, 0); g.add(post); }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.34, 0.4), frame); lintel.position.y = 4.4; g.add(lintel);
    const closet = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.1, 0.1), plainMaterial(0x0a0a0e, { roughness: 0.9 })); closet.position.set(0, 2.1, -0.12); g.add(closet);   // what is behind it
    const hinge = new THREE.Group(); hinge.position.set(-1.1, 0, 0.12); g.add(hinge);
    leaf = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.1, 0.12), plainMaterial(baby ? 0x6b3a2a : 0x2a6a4a, { roughness: 0.4 })); leaf.position.set(1.1, 2.1, 0); hinge.add(leaf);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), frame); knob.position.set(0.9, 0.0, 0.1); leaf.add(knob);
    leaf = hinge;
  }
  w.add(g);
  w.sign({ text: baby ? `${label} (decoy)` : label, x, y: y + (kind === 'goal' ? 4.1 : 4.95), z, w: 3.4, h: 0.9, color: baby ? '#ffb48a' : '#6cf0b2', double: true, tw: 512, size: 82, glow: true, rotY: yaw });
  const fire = () => {
    if (game.state !== 'playing' || w.completed) return;
    if (say) game.say(say, { priority: 2 });
    if (onTouch) onTouch(game); else game.kill(reason);
  };
  if (use) {
    // press E on it: the door swings open on a broom closet with no floor
    const it = w.interactable({
      x, y: y + 2.0, z, w: 2.4, h: 4, d: 2.4, label: baby ? 'Open the door (staff closet)' : 'Open the EXIT door', range: 4,
      onUse: () => {
        if (it.used) return; it.used = true;
        game.audio.click();
        const t0 = performance.now();
        const swing = () => { const k = Math.min(1, (performance.now() - t0) / 450); if (leaf) leaf.rotation.y = -k * 1.5; if (k < 1) later(w, 30, swing); else later(w, 350, fire); };
        swing();
      },
      enabled: () => !it.used,
    });
    w.onRespawn(() => { it.used = false; if (leaf) leaf.rotation.y = 0; });
  } else {
    w.trigger({ x, y: y + 1.9, z, w: 2.4, h: 3.6, d: 2.4, once: true, resetOnRespawn: true, onEnter: fire });
  }
  return g;
}

/**
 * A real goal that is hard to get: whenever you come within `radius` it hops to the next spot. After the last hop it stays put.
 * (It does not reset when you die, so the trick costs you once. Baby Mode: it only hops once.)
 */
export function evasiveGoal(w, game, { spots, radius = 6, color = 0x2dd4bf, onReach = null, say = null } = {}) {
  const goal = w.goal({ x: spots[0].x, y: spots[0].y ?? 0, z: spots[0].z, color, onReach: onReach || (() => game.completeLevel()) });
  let k = 0, cool = 0;
  w.onUpdate((dt) => {
    cool -= dt;
    const maxK = game.baby ? Math.min(1, spots.length - 1) : spots.length - 1;
    if (k >= maxK || cool > 0 || game.state !== 'playing') return;
    const p = game.player;
    if (Math.hypot(p.x - goal.x, p.z - goal.z) < radius && Math.abs(p.y - goal.y) < 4) {
      k++; cool = 0.6;
      const s = spots[k];
      w.burst(new THREE.Vector3(goal.x, goal.y + 1.9, goal.z), color, 18, 4);
      goal.setPos(s.x, s.y ?? 0, s.z);
      game.audio.glitch();
      if (say) game.say(Array.isArray(say) ? say[Math.min(k - 1, say.length - 1)] : say, { priority: 1 });
    }
  });
  return goal;
}

// ================================================================================================
//  Checkpoints that are not what they seem
// ================================================================================================
/**
 * mode 'fake'   : looks real, saves nothing (the pole is a hair crooked). The host reveals it the first time you die.
 * mode 'expire' : a real checkpoint that forgets itself after `ttl` seconds (the flag says so, in small print). Baby Mode: it keeps.
 * mode 'rewind' : "checkpoint saved!" and puts you back at `back` {x,y,z} (a fake one that also moves you).
 */
export function trollCheckpoint(w, game, { x, y, z, mode = 'fake', ttl = 25, back = null, say = null, label = null } = {}) {
  const st = state(w);
  if (mode === 'expire') {
    // this trigger is created BEFORE the checkpoint's own one, so it still sees the checkpoint that is about to be replaced
    const rec = { cp: null, prev: null };
    w.trigger({
      x, y: y + 1.2, z, w: 2.4, h: 3.2, d: 2.4, once: false,
      onEnter: () => { if (rec.cp?.used || game.baby) return; rec.prev = { ...w.respawn }; st.pending = rec; },
    });
    const cp = w.checkpoint({ x, y, z, real: true, label: label || `CHECKPOINT · ${ttl}s*` });
    rec.cp = cp;
    w.trigger({
      x, y: y + 1.2, z, w: 2.4, h: 3.2, d: 2.4, once: false,
      onEnter: () => { if (st.pending === rec && rec.prev && !game.baby) { st.exp = { cp, prev: rec.prev, until: w.t + ttl, say }; st.pending = null; game.ui.toast(`Checkpoint valid for ${ttl}s*`, 'gold'); } },
    });
    return cp;
  }
  const cp = w.checkpoint({ x, y, z, real: false, label: label || 'CHECKPOINT' });
  if (mode === 'rewind' && back) {
    w.trigger({
      x, y: y + 1.2, z, w: 2.4, h: 3.2, d: 2.4, once: false,
      onEnter: () => {
        if (game.baby) return;
        later(w, 650, () => { if (game.state !== 'playing') return; game.player.teleport(back.x, back.y + 0.001, back.z); game.audio.glitch(); game.ui.glitch(true); later(w, 200, () => game.ui.glitch(false)); if (say) game.say(say, { priority: 2 }); });
      },
    });
  }
  return cp;
}

// ================================================================================================
//  Floors that lie
// ================================================================================================
/**
 * A platform that gives way once you are standing on it and have passed `frac` of its length along `axis` (`dir` = which way you cross):
 * it shakes for `delay` seconds, then is gone for `back` seconds. The tell: it shimmers. The way through: keep running.
 */
export function vanishAfter(w, game, plat, { axis = 'z', dir = -1, frac = 0.5, delay = 0.5, back = 3.2, say = null } = {}) {
  const st = state(w), b = plat.body;
  const half = axis === 'z' ? b.hz : b.hx;
  let shake = 0, gone = 0, said = false;
  plat.o.moving = true; plat.group.matrixAutoUpdate = true;
  const flick = new THREE.Mesh(new THREE.PlaneGeometry(b.hx * 2 - 0.1, b.hz * 2 - 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  flick.rotation.x = -Math.PI / 2; flick.position.y = plat.o.h / 2 + 0.01; plat.group.add(flick);
  const home = () => plat.group.position.set(plat.base.x, plat.base.y, plat.base.z);
  st.flips.push((dt) => {
    flick.material.opacity = 0.07 * (0.5 + 0.5 * Math.sin(w.t * 9 + b.x));       // the tell: it shimmers
    if (gone > 0) { gone -= dt; if (gone <= 0) { plat.setEnabled(true); home(); } return; }
    if (shake > 0) {
      shake -= dt;
      plat.group.position.set(plat.base.x + (Math.random() - 0.5) * 0.08, plat.base.y, plat.base.z + (Math.random() - 0.5) * 0.08);
      if (shake <= 0) { gone = back; plat.setEnabled(false); home(); }
      return;
    }
    const p = game.player;
    if (!plat.body.enabled || !(p.grounded && p.ground === plat.body)) return;
    const prog = ((axis === 'z' ? p.z - b.z : p.x - b.x) * dir + half) / (2 * half);
    if (prog >= frac) {
      shake = Math.max(0.05, game.baby ? delay * 1.6 : delay); game.audio.crumble();
      if (say && !said) { said = true; game.say(say, { priority: 1 }); }
    }
  });
  w.onRespawn(() => { shake = 0; gone = 0; plat.setEnabled(true); home(); });
  return plat;
}

/** A solid platform drawn as a faint outline over the void. A tell: its rim glows (look for it). */
export function ghostPlat(w, o) {
  const plat = w.plat({ ...o, tex: o.tex, color: o.color ?? 0x88aaff });
  plat.group.traverse((m) => {
    if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.16; m.material.depthWrite = false; m.castShadow = false; }
  });
  const rim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(o.w, o.h ?? 1, o.d)), new THREE.LineBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.7 }));
  plat.group.add(rim);
  return plat;
}

/**
 * Two platforms, only one solid: when none of the two is on screen (and you are not near either) for `grace` seconds, they swap.
 * `a` starts solid. Only reliable where you must turn away to do something else.
 */
export function lookAwayFlip(w, game, a, b, { grace = 0.6, near = 5, say = null } = {}) {
  const st = state(w);
  b.setEnabled(false);
  let away = 0, said = false;
  const seen = (q) => inView(game, q.body.x, q.top, q.body.z, 0.05);
  st.flips.push((dt) => {
    const p = game.player;
    if (Math.hypot(p.x - a.body.x, p.z - a.body.z) < near || Math.hypot(p.x - b.body.x, p.z - b.body.z) < near) { away = 0; return; }
    if (seen(a) || seen(b)) { away = 0; return; }
    away += dt;
    if (away > grace) { away = 0; const on = a.body.enabled; a.setEnabled(!on); b.setEnabled(on); if (say && !said) { said = true; game.say(say, { priority: 1 }); } }
  });
  w.onRespawn(() => { a.setEnabled(true); b.setEnabled(false); away = 0; });
}

// ================================================================================================
//  Pacing: stage banners and a hint that only leads to the next stage
// ================================================================================================
/** "STAGE 2 / 5 · THE MOP LANE", fading in and out in the middle of the screen. Call it from a trigger or a checkpoint. */
export function stageTitle(game, w, n, total, name) {
  state(w);
  let el = document.getElementById('stagetitle');
  if (!el) { el = document.createElement('div'); el.id = 'stagetitle'; document.getElementById('app').appendChild(el); }
  el.innerHTML = '<small></small><b></b>';
  el.querySelector('small').textContent = `STAGE ${n} / ${total}`; el.querySelector('b').textContent = name;
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  game.audio.chime?.();
}
/** A trigger that shows the banner when you first walk in (once per attempt of that stage). */
export function stageZone(game, w, box, n, total, name) {
  return w.trigger({ ...box, once: true, onEnter: () => stageTitle(game, w, n, total, name) });
}

/**
 * Hint that never spoils more than the next stage. `stages[i] = { at: {x,y,z} (where you respawn once you are in it), route: [{x,y,z}…] }`.
 * The trail runs from where you stand along the current stage's route, ending at the next stage's `at` (or `end` for the last one).
 */
export function stageHint(w, stages, { end = null, flat = false } = {}) {
  w.hintFlat = flat;
  w.hintFn = (g) => {
    const p = g.player;
    let cur = 0, best = Infinity;
    stages.forEach((s, i) => { const d = Math.hypot(s.at.x - w.respawn.x, s.at.z - w.respawn.z) + Math.abs(s.at.y - w.respawn.y) * 0.3; if (d < best) { best = d; cur = i; } });
    const next = stages[cur + 1]?.at || end || (w.goalObj ? { x: w.goalObj.x, y: w.goalObj.y, z: w.goalObj.z } : null);
    const route = [...stages[cur].route, ...(next ? [next] : [])];
    let bi = 0, bd = Infinity;
    route.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.z - p.z) + Math.abs(q.y - p.y) * 0.6; if (d < bd) { bd = d; bi = i; } });
    const out = [{ x: p.x, y: p.y + 0.15, z: p.z }];
    for (let k = bi + (bd < 1.2 ? 1 : 0); k < route.length && out.length < 6; k++) out.push({ x: route[k].x, y: route[k].y + 0.15, z: route[k].z });
    return out.length >= 2 ? out : null;
  };
}
