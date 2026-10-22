import * as THREE from 'three';
import { glowMaterial } from '../../engine/materials.js';
import { COL } from './kit.js';
import { canvasPlane, text, panelBg, glyph } from './communication-kit.js';

// Helpers for session 13 (Karaoke Night). The world runs on a BEAT CLOCK that is a pure function of w.t (which the pair keeps in step),
// plus one shared value ('kc') for the key change. Nothing here makes a sound: beats are lights, bars and boards.
// Tolerances: a beat tile turns solid LEAD s before its lit beat and stays solid LAG s after it, so 0.25 s of lag or sloppiness is free.

export const LEAD = 0.2, LAG = 0.25;
export const mod = (a, b) => ((a % b) + b) % b;
export const NOTE = [
  { name: 'RED', hex: 0xff5a5f, css: '#ff5a5f' },
  { name: 'BLUE', hex: 0x4aa3ff, css: '#4aa3ff' },
  { name: 'YELLOW', hex: 0xffd23f, css: '#ffd23f' },
];

/** The beat clock. beat(t) is continuous; tempo changes are segments ({t, b, bpm}) shared through c.set('kc', {at, bpm}). */
export function makeClock(w, c, bpm0 = 60) {
  const segs = [{ t: 0, b: 0, bpm: bpm0 }];
  const seg = (t) => { let s = segs[0]; for (const q of segs) if (q.t <= t) s = q; return s; };
  const clk = {
    segs, tiles: [], bars: [],
    beat: (t = w.t) => { const s = seg(t); return s.b + ((t - s.t) * s.bpm) / 60; },
    bpm: (t = w.t) => seg(t).bpm,
    spb: (t = w.t) => 60 / seg(t).bpm,
    pending: null,                                           // {at, bpm} while a key change is announced but has not happened yet
    change(at, bpm) {
      const last = segs[segs.length - 1];
      if (at <= last.t + 1e-6) return;
      segs.push({ t: at, b: clk.beat(at), bpm });
    },
  };
  c.on('kc', (v) => { if (!v) return; clk.pending = v; });
  w.updaters.push((dt, t) => {
    if (clk.pending && t >= clk.pending.at - 0.05) { clk.change(clk.pending.at, clk.pending.bpm); if (t >= clk.pending.at) clk.pending = null; }
  });
  // drive all tiles and bars from one place
  w.updaters.push((dt, t) => {
    const b = clk.beat(t), sp = clk.spb(t), pulse = 0.5 + 0.5 * Math.cos((b % 1) * Math.PI * 2);
    for (const tl of clk.tiles) tl.step(b, sp, pulse, t);
    for (const bar of clk.bars) bar.step(b, pulse);
  });
  return clk;
}

/**
 * A tile that is lit on a pattern of beats: lit when mod(floor(beat) - start, cycle) < len.
 * `who`: 'all' | 'p1' | 'p2'. A tile that belongs to the partner is only drawn as a coloured ghost for you (not solid, not a platform).
 */
export function beatTile(w, clk, o) {
  const { x, y = 0, z, size = 3.2, d = 3, h = 0.6, who = 'all', start = 0, len = 2, cycle = 6, hex = null } = o;
  const me = w.coop.me;
  const col = hex ?? (who === 'p1' ? COL.p1 : who === 'p2' ? COL.p2 : 0xffc83d);
  const pl = w.plat({ x, y, z, w: size, d, h, tex: 'grid', color: col, trim: col, roughness: 0.3, radius: 0.06, path: o.path });
  pl.group.matrixAutoUpdate = true;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(size - 0.3, d - 0.3), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = h / 2 + 0.02; pl.group.add(glow);
  const ghost = new THREE.Mesh(new THREE.PlaneGeometry(size, d), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  ghost.rotation.x = -Math.PI / 2; ghost.position.set(x, y + 0.03, z); w.add(ghost);
  const mine = who === 'all' || who === me;
  const lit = (b) => mod(Math.floor(b) - start, cycle) < len;
  const tl = {
    pl, x, y, z, who, lit, solid: false, state: 'off',
    solidAt: (t) => { const b = clk.beat(t), sp = clk.spb(t); return lit(b + LEAD / sp) || lit(b - LAG / sp); },
    /** seconds of unbroken solidity from now (scanned, max 4 s) */
    left(t = w.t) { if (!tl.solidAt(t)) return 0; let s = 0; while (s < 4 && tl.solidAt(t + s + 0.1)) s += 0.1; return s; },
    step(b, sp, pulse) {
      const solid = lit(b + LEAD / sp) || lit(b - LAG / sp);
      const litNow = lit(b), next = !solid && lit(b + 1);
      tl.solid = solid; tl.state = litNow ? 'lit' : solid ? 'fade' : next ? 'next' : 'off';
      pl.body.enabled = solid && mine;
      pl.group.visible = solid && mine;
      glow.material.opacity = litNow ? 0.4 + 0.4 * pulse : solid ? 0.12 : 0;
      ghost.material.opacity = solid ? (mine ? 0.04 : 0.3 + 0.2 * pulse) : next ? 0.28 + 0.22 * pulse : 0.09;
    },
  };
  clk.tiles.push(tl);
  return tl;
}

/** Row of 4 (or n) lights; the current beat of the bar glows, the downbeat is gold. */
export function beatBar(w, clk, { x, y, z, rotY = 0, n = 4, label = null }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; w.add(g);
  const cells = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.18), new THREE.MeshBasicMaterial({ color: 0x222222, toneMapped: false }));
    m.position.x = (i - (n - 1) / 2) * 1.5; g.add(m); cells.push(m);
  }
  const tmp = new THREE.Color();
  const bar = {
    step(b, pulse) {
      const k = mod(Math.floor(b), n);
      cells.forEach((m, i) => {
        const base = i === 0 ? 0xffc83d : 0xcfe8ff;
        tmp.setHex(base).multiplyScalar(i === k ? 1.2 + 1.1 * pulse : 0.12);
        m.material.color.copy(tmp);
        const s = i === k ? 1.0 + 0.12 * pulse : 0.88; m.scale.set(s, s, 1);
      });
    },
  };
  clk.bars.push(bar);
  return bar;
}

/** Board with live text (key-change countdown, hold meter, ...). */
export function liveBoard(w, { x, y, z, width, height, rotY = 0, px = 640 }) {
  let last = null;
  const m = canvasPlane(w, { x, y, z, width, height, rotY, px, draw: (g, W, H) => { panelBg(g, W, H, '#ffc83d', '#14161f'); } });
  m.show = (key, fn) => { if (key === last) return; last = key; m.redraw((g, W, H) => { panelBg(g, W, H, '#ffc83d', '#14161f'); fn(g, W, H); }); };
  return m;
}

/** A glyph + colour tile for the lyric rows. Wrong tiles drop away (quietly) a moment after anyone steps on them, then come back. */
export function noteTile(w, { x, y = 0, z, k, size = 2.8, d = 3, right = false, pulse = null, clk = null }) {
  const n = NOTE[k], h = 0.6;
  const pl = w.plat({ x, y, z, w: size, d, h, tex: 'grid', color: n.hex, trim: n.hex, roughness: 0.35, radius: 0.06 });
  pl.o.moving = true; pl.group.matrixAutoUpdate = true;
  const sym = canvasPlane(w, { x, y: y + 0.03, z, width: 1.7, height: 1.7, px: 128, draw: (g, W, H) => { g.clearRect(0, 0, W, H); glyph(g, k, W / 2, H / 2, W * 0.34, '#10131c'); } });
  sym.material.transparent = true; sym.rotation.set(-Math.PI / 2, 0, 0);
  w.scene.remove(sym); sym.position.set(0, h / 2 + 0.03, 0); pl.group.add(sym);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = h / 2 + 0.05; pl.group.add(ring);
  const st = { pl, k, right, x, z, state: 'idle', t: 0, vy: 0, y };
  if (!right) {                                   // a wrong note
    w.updaters.push((dt) => {
      const p = pl, pla = w.game.player;
      if (st.state === 'idle') {
        if ((pla.grounded && pla.ground === p.body) || w.coop.partnerOn?.(p.body)) { st.state = 'shake'; st.t = 0; }
      } else if (st.state === 'shake') {
        st.t += dt;
        p.group.position.set(p.base.x + (Math.random() - 0.5) * 0.08, p.base.y, p.base.z + (Math.random() - 0.5) * 0.08);
        ring.material.opacity = 0.8; ring.material.color.setHex(0xff4d5e);
        if (st.t >= 0.7) { st.state = 'fall'; st.t = 0; st.vy = 0; p.body.enabled = false; }
      } else if (st.state === 'fall') {
        st.t += dt; st.vy -= 30 * dt; p.group.position.y += st.vy * dt;
        p.group.scale.setScalar(Math.max(0.01, 1 - st.t * 0.7));
        if (st.t > 1.3) { st.state = 'gone'; st.t = 0; p.group.visible = false; }
      } else if (st.state === 'gone') {
        st.t += dt;
        if (st.t >= 3.5) { st.state = 'idle'; p.setPos(p.base.x, p.base.y, p.base.z); p.setEnabled(true); p.group.scale.setScalar(1); ring.material.opacity = 0; }
      }
    });
    w.respawnHooks.push(() => { if (st.state !== 'idle') { st.state = 'idle'; pl.setPos(pl.base.x, pl.base.y, pl.base.z); pl.setEnabled(true); pl.group.scale.setScalar(1); ring.material.opacity = 0; } });
  }
  if (pulse && right) {                            // the right note breathes with the beat (everyone sees it)
    w.updaters.push((dt, t) => { const b = clk.beat(t); ring.material.color.setHex(0xffffff); ring.material.opacity = 0.15 + 0.6 * Math.max(0, Math.cos((b % 1) * Math.PI * 2)); });
  }
  return st;
}

/** Bar-style progress meter drawn on a board. */
export function drawMeter(g, W, H, frac, title, sub, color = '#ffc83d') {
  text(g, title, W / 2, H * 0.24, Math.min(H * 0.24, 46), '#fff3d0');
  g.fillStyle = '#262a38'; g.fillRect(W * 0.08, H * 0.46, W * 0.84, H * 0.22);
  g.fillStyle = color; g.fillRect(W * 0.08, H * 0.46, W * 0.84 * Math.max(0, Math.min(1, frac)), H * 0.22);
  text(g, sub, W / 2, H * 0.84, Math.min(H * 0.16, 30), '#9aa0b0', 'center', '400');
}
