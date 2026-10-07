import * as THREE from 'three';
import { cursor, onPlat, floaters, orbs } from './common.js';
import { glowMaterial } from '../engine/materials.js';

// Level 4 — Technical Difficulties. The fourth wall is a suggestion. Everything that goes wrong
// here is telegraphed (ping turns red before a lag spike, controls announce themselves…) — it's
// annoying, not unfair.

const LOAD_TIPS = ['Reticulating splines', 'Calibrating gravity', 'Hiding checkpoints', 'Teaching the host humility (failed)', 'Downloading more RAM', 'Buffering your patience'];
const rand = (a, b) => a + Math.random() * (b - a);

export default {
  id: 'l4',
  name: 'Technical Difficulties',
  music: 'l4',
  glitchTheme: true,
  completeQuip: 'The engineers have been told. They\'re fine. Everyone is fine.',
  titleCam: { center: [0, 0, -30], radius: 22, height: 8 },

  // The pause menu fights back here.
  pauseTroll(game) {
    const b = game.ui.el['btn-resume'];
    let dodges = 0;
    game.ui.el['pause-quip'].textContent = game.touch ? '“Resume? Just tap it. Come on. Right there.”' : '“Resume? Just click it. Come on. Right there.”';
    game.say('l4.pause', { priority: 2 });
    const off = () => { b.removeEventListener('mouseenter', b._h); b.removeEventListener('touchstart', b._p); b._h = null; b._p = null; };
    b._h = () => {
      if (dodges < 6) { dodges++; b.style.transform = `translate(${rand(-190, 190)}px, ${rand(-130, 130)}px)`; game.audio.tick(); return true; }
      b.style.transform = ''; game.say('l4.pause.fine', { priority: 2 }); off(); return false;
    };
    b.addEventListener('mouseenter', b._h);
    // a finger has no hover, so on touch the button dodges the moment it is touched; cancelling touchstart also cancels the click
    b._p = (e) => { e.preventDefault(); b._h(); };
    b.addEventListener('touchstart', b._p, { passive: false });
  },

  build(w, game) {
    w.env({
      top: 0x04050f, horizon: 0x1a0a3a, bottom: 0x03030a,
      fog: { color: 0x0a0820, near: 40, far: 320 },
      sun: { color: 0xb49bff, intensity: 2.0, dir: [0.3, 0.8, 0.4] },
      hemi: { sky: 0x6a7aff, ground: 0x4a2a70, intensity: 1.0 },
      exposure: 1.05,
      stars: 0.8,
      bloom: { strength: 0.95, radius: 0.6, threshold: 0.8 },
      clouds: { count: 24, color: 0x6a3aff, y: [-40, -16], radius: [30, 260], opacity: 0.2, size: [60, 130] },
      motes: { color: 0x7ae8ff, count: 220, size: 0.08, opacity: 0.7 },
    });
    w.setTheme({ tex: 'grid', color: 0xffffff, trim: 0x50dcff, edge: 0x50dcff, edgeOpacity: 0.3, accent: 0xff3df0, danger: 0xff2d4d, roughness: 0.4, metalness: 0.4 });
    w.spawn = { x: 0, y: 0, z: 3, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -30;

    const C = cursor(w, { y: 0, z: -5 });
    w.plat({ x: 0, y: 0, z: 0, w: 10, d: 10, path: true });

    // ---- S1: loading corridor -----------------------------------------------------------------
    const load = C.place({ gap: 0, d: 17, wd: 6 });
    const cp1 = C.place({ gap: 2.4, d: 8, wd: 8 });
    w.checkpoint({ x: 0, y: 0, z: cp1.body.z, real: true });

    // ---- S2: the controls get "improved" ------------------------------------------------------
    const zig = [];
    [-2, 2, -2, 2, -2, 2].forEach((x) => zig.push(C.place({ gap: 2.4, d: 3.4, wd: 3.4, x })));
    const cp2 = C.place({ gap: 2.4, d: 8, wd: 8 });
    w.checkpoint({ x: 0, y: 0, z: cp2.body.z, real: true });

    // ---- S3: lag ------------------------------------------------------------------------------
    const lagPlats = [];
    for (let i = 0; i < 5; i++) lagPlats.push(C.place({ gap: i === 0 ? 2.6 : 2.6, d: 6.5, wd: 5, x: [0, 1.2, -1.2, 1.2, 0][i] }));
    const cp3 = C.place({ gap: 2.6, d: 8, wd: 8 });
    w.checkpoint({ x: 0, y: 0, z: cp3.body.z, real: true });

    // ---- S4: please stand by ------------------------------------------------------------------
    const stand = C.place({ gap: 2.4, d: 14, wd: 6 });

    // ---- S5: a word from our sponsor ----------------------------------------------------------
    const stones = [];
    for (let i = 0; i < 8; i++) stones.push(C.place({ gap: i === 0 ? 2.4 : 2.4, d: 3, wd: 3 }));
    const cp4 = C.place({ gap: 2.4, d: 8, wd: 8 });
    w.checkpoint({ x: 0, y: 0, z: cp4.body.z, real: true });

    // ---- S6: the final stretch ----------------------------------------------------------------
    [{ gap: 3.0, d: 2.4, wd: 2.6, x: 0, dy: 0.3 }, { gap: 3.2, d: 2.2, wd: 2.4, x: 1.6, dy: 0.3 }, { gap: 3.3, d: 2.2, wd: 2.4, x: -1.4, dy: 0.3 }, { gap: 3.4, d: 2.2, wd: 2.4, x: 0, dy: 0.2 }]
      .forEach((s) => C.place(s));
    const end = C.place({ gap: 3.4, d: 10, wd: 10, dy: 0.3 });
    w.goal({ x: 0, y: C.y, z: end.body.z - 1, color: 0xff3df0,
      onReach: () => { game.say('l4.complete', { priority: 2 }); game.completeLevel(); } });
    w.light(0xff3df0, 14, 22, 0, C.y + 3, end.body.z + 1);

    // ---- set dressing -------------------------------------------------------------------------
    const grid = new THREE.GridHelper(900, 180, 0x50dcff, 0x1d3f7a);
    grid.position.set(0, -34, -170); grid.material.transparent = true; grid.material.opacity = 0.5; grid.material.depthWrite = false;
    w.add(grid);
    const ledCols = [0x50dcff, 0xff3df0, 0x5dff9a];
    const ledMats = ledCols.map((c) => glowMaterial(c, 1.8, 0.99));
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x0c1020, roughness: 0.45, metalness: 0.5 });
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1, z = -6 - Math.floor(i / 2) * 22 - rand(0, 6), x = side * rand(14, 26), top = rand(4, 26);
      const rack = new THREE.Mesh(new THREE.BoxGeometry(4.2, top + 36, 4.2), rackMat);
      rack.position.set(x, (top - 36) / 2, z); w.add(rack);
      for (let k = 0; k < 7; k++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, rand(0.8, 3.2)), ledMats[Math.floor(Math.random() * 3)]);
        led.position.set(x - side * 2.14, rand(-6, top - 1), z + rand(-1, 1)); w.add(led);
      }
    }
    w.onUpdate((dt, t) => { ledMats.forEach((m, i) => { m.opacity = 0.55 + 0.45 * Math.abs(Math.sin(t * (2.2 + i) + i * 2)); }); });
    floaters(w, { count: 14, x: [-70, 70], y: [4, 50], z: [-20, -260], colors: [0x50dcff, 0xff3df0, 0x5dff9a], avoid: 12, seed: 11, size: [1.2, 3] });
    orbs(w, { count: 40, x: [-24, 24], y: [-2, 18], z: [4, -270], color: 0x7ae8ff, size: 0.12, intensity: 2.4 });
    const glyphs = ['ERROR 404', 'SYNC FAILED', 'NaN', 'LAG', '0xDEADBEEF', 'PING 999', 'CONNECTION LOST', 'UNDEFINED', 'REBOOTING…', 'BUFFERING'];
    glyphs.forEach((g, i) => {
      const side = i % 2 ? 1 : -1;
      const s = w.sign({ text: g, x: side * rand(16, 38), y: rand(6, 24), z: -10 - i * 24, w: 9, h: 2.2, color: i % 3 === 0 ? '#ff3df0' : '#50dcff', glow: 1.3, tw: 1024, rotY: -side * 0.5 });
      s.userData.ph = Math.random() * 6; s.userData.y0 = s.position.y;
      w.onUpdate((dt, t) => { s.position.y = s.userData.y0 + Math.sin(t * 0.6 + s.userData.ph) * 0.8; });
    });
    w.sign({ text: 'TECHNICAL DIFFICULTIES', x: 0, y: 9, z: -8, w: 16, h: 2.6, color: '#d9fbff', glow: 1.3, glowColor: '#50dcff', tw: 1024 });
    const FLOOR = -Math.PI / 2;
    w.sign({ text: 'LOADING ▸', x: 0, y: 0.03, z: load.body.z + 5, w: 4, h: 1.3, rotX: FLOOR, color: '#50dcff', double: false, tw: 512 });
    w.sign({ text: 'A ⇄ D ?', x: 0, y: 0.03, z: cp1.body.z, w: 4, h: 1.3, rotX: FLOOR, color: '#ff3df0', double: false, tw: 512 });
    w.sign({ text: 'PING ▸', x: 0, y: 0.03, z: cp2.body.z, w: 4, h: 1.3, rotX: FLOOR, color: '#50dcff', double: false, tw: 512 });
    w.sign({ text: 'STAND BY', x: 0, y: 0.03, z: stand.body.z + 3, w: 4.6, h: 1.3, rotX: FLOOR, color: '#ffffff', double: false, tw: 512 });

    // ---- the gags -----------------------------------------------------------------------------
    const ui = game.ui;
    const gag = { loadT: -1, lag: false, lagT: 0, spiked: false, tip: 0, flick: 8 };
    const stopLoading = () => { gag.loadT = -1; ui.loading(false); };
    w.onRespawn(() => { stopLoading(); gag.lag = false; ui.setPing(false); ui.ad(false); ui.bars(false); game.mods.swapStrafe = false; });

    // loading screen: ~1.8s of blindness on a long straight bridge
    w.trigger({
      x: 0, y: 1.5, z: load.body.z + 6.5, w: 7, h: 4, d: 1, resetOnRespawn: true,
      onEnter: () => { gag.loadT = 0; ui.loading(true); ui.setLoading(0, LOAD_TIPS[0]); game.say('l4.loading', { priority: 2 }); },
    });
    // controls patch
    w.trigger({
      x: 0, y: 1.5, z: cp1.body.z - 3, w: 8, h: 4, d: 1.2, resetOnRespawn: true,
      onEnter: () => { game.mods.swapStrafe = true; ui.toast('PATCH 4.0.1 — A ⇄ D swapped (nobody asked)', 'bad'); game.audio.glitch(); game.say('l4.controls', { priority: 2 }); },
    });
    w.trigger({
      x: 0, y: 1.5, z: cp2.body.z, w: 8, h: 4, d: 6, once: false,
      onEnter: () => { if (game.mods.swapStrafe) { game.mods.swapStrafe = false; ui.toast('Controls restored', 'good'); game.say('l4.controls.back', { priority: 1 }); } },
    });
    // lying death counter starts once the controls have been "patched"
    w.trigger({ x: 0, y: 1.5, z: cp2.body.z, w: 8, h: 4, d: 6, once: true, onEnter: () => { game.mods.lieCounter = true; game.ui.setDeaths(game._deathText()); } });
    // lag
    onPlat(w, lagPlats[0], () => { gag.lag = true; gag.lagT = 0; gag.spiked = false; game.say('l4.lag', { priority: 2 }); w.after(5.5, () => game.say('l4.lag.watch')); }, { once: false });
    w.trigger({ x: 0, y: 1.5, z: cp3.body.z, w: 8, h: 4, d: 6, once: false, onEnter: () => { gag.lag = false; ui.setPing(false); } });
    // fake crash
    onPlat(w, stand, () => {
      game.say('l4.crash', { priority: 2 });
      ui.bars(true); game.audio.beep(1.4);
      game.freeze(3.6, () => { ui.bars(false); game.say('l4.crash.back', { priority: 2 }); });
    });
    // the ad
    w.trigger({
      x: 0, y: 1.5, z: stones[0].body.z + 3.5, w: 7, h: 4, d: 1, resetOnRespawn: true,
      onEnter: () => {
        ui.ad(true); ui.setAdSeconds(5); game.say('l4.ad', { priority: 2 });
        for (let s = 4; s >= 0; s--) w.after(5 - s, () => { ui.setAdSeconds(s); if (s === 0) ui.ad(false); });
        w.after(2, () => game.say('l4.ad.skip', { priority: 2 }));
      },
    });

    let intro = false, t = 0;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing' || g.frozen) return;
      t += dt;
      if (!intro && t > 1.2) { intro = true; g.say('l4.intro'); }
      if (gag.loadT >= 0) {
        gag.loadT += dt;
        const k = Math.min(1, gag.loadT / 1.8);
        const tip = Math.floor(gag.loadT / 0.35) % LOAD_TIPS.length;
        ui.setLoading(k * 100 * (0.8 + Math.random() * 0.2), LOAD_TIPS[tip]);
        if (gag.loadT >= 1.8) { stopLoading(); g.say('l4.loading.done'); }
      }
      if (gag.lag) {
        gag.lagT += dt;
        const ph = gag.lagT % 5;
        if (ph < 3.3) { ui.setPing(true, 22 + Math.random() * 36, false); gag.spiked = false; }
        else if (ph < 4.3) ui.setPing(true, 80 + (ph - 3.3) * 900, true);
        else { ui.setPing(true, 999, true); if (!gag.spiked) { gag.spiked = true; g.rewind(0.9); } }
      }
      // occasional harmless glitch flicker
      gag.flick -= dt;
      if (gag.flick <= 0) { gag.flick = rand(14, 30); ui.glitch(true); g.audio.glitch(); setTimeout(() => ui.glitch(false), 180); }
    };
    let counterSaid = false;
    w.hooks.onDeath = () => {
      if (game.mods.lieCounter && !counterSaid) { counterSaid = true; game.say('l4.counter', { priority: 2 }); return true; }
      return false;
    };
    void zig; void load;
  },
};
