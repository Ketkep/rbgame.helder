import * as THREE from 'three';
import { glowMaterial, plainMaterial } from '../../engine/materials.js';
import { COL, plate, riser } from './kit.js';

// Helpers for session 6 (The Newlywed Game): redrawable signs, answer buttons, local respawn marks and a leapfrog bridge run.

const FONT = '"Archivo Black", Impact, sans-serif';

/** A sign whose text can change (a canvas texture that is redrawn on `.set(text)`). Purely local/visual. */
export function liveSign(w, { x, y, z, w: ww = 4, h = 1.2, rotY = 0, rotX = 0, tw = 512, color = '#fff3d0', bg = 'rgba(20,16,12,0.78)', border = '#ffc83d', size = 0, align = 'center', glow = 1.6 }) {
  const th = Math.max(32, Math.round(tw * h / ww));
  const cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false });
  if (glow) mat.color.setScalar(glow);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ww, h), mat);
  mesh.position.set(x, y, z); mesh.rotation.set(rotX, rotY, 0, 'YXZ');
  w.add(mesh);
  w.disposers.push(() => { tex.dispose(); mat.dispose(); });
  const st = { mesh, text: null, opt: '' };
  st.set = (text, o = {}) => {
    const col = o.color || color, bd = o.border || border, b = o.bg ?? bg;
    const key = text + '|' + col + '|' + bd + '|' + b;
    if (key === st.opt) return;
    st.opt = key; st.text = text;
    ctx.clearRect(0, 0, tw, th);
    if (b) { ctx.fillStyle = b; ctx.fillRect(0, 0, tw, th); }
    if (bd) { ctx.strokeStyle = bd; ctx.lineWidth = 8; ctx.strokeRect(6, 6, tw - 12, th - 12); }
    const lines = String(text).split('\n'), pad = 22;
    let fs = size || Math.floor((th - pad * 2) / lines.length);
    for (;;) {
      ctx.font = `${fs}px ${FONT}`;
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      if (widest <= tw - pad * 2 || fs < 10) break;
      fs -= 2;
    }
    ctx.textBaseline = 'middle'; ctx.textAlign = align; ctx.fillStyle = col;
    const lh = fs * 1.12, px = align === 'center' ? tw / 2 : pad + 6;
    lines.forEach((l, i) => ctx.fillText(l, px, th / 2 + (i - (lines.length - 1) / 2) * lh));
    tex.needsUpdate = true;
  };
  return st;
}

/**
 * A big round answer button on a post. `role`: only that role can press it ('all' = either).
 * Returns { label(text), lit(bool) }.
 */
export function pedestal(w, { x, y = 0, z, role = 'all', label = '', color = 0xffc83d, onPress, enabled = null, signW = 2.3, showSign = true }) {
  const c = w.coop;
  let text = label, lit = false;
  const g = new THREE.Group(); g.position.set(x, y, z); w.add(g);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 1.0, 20), plainMaterial(0x2b2f3a, { metalness: 0.5, roughness: 0.4 })); post.position.y = 0.5; g.add(post);
  const capMat = glowMaterial(color, 0.9);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 20), capMat); cap.position.y = 1.08; g.add(cap);
  const mine = role === 'all' || role === c.me;
  const sg = showSign ? liveSign(w, { x, y: y + 2.15, z, w: signW, h: 0.8, tw: 512, border: '#' + new THREE.Color(color).getHexString() }) : null;
  const st = {
    label(t) { text = t; sg?.set(String(t)); },
    lit(v) { lit = !!v; },
  };
  st.label(label);
  w.updaters.push((dt) => {
    const on = lit && mine;
    capMat.color.setHex(color).multiplyScalar(on ? 2.4 : (mine ? 0.8 : 0.25));
    cap.position.y += ((on ? 1.0 : 1.08) - cap.position.y) * Math.min(1, dt * 12);
  });
  w.interactable({ x, y: y + 1.2, z, w: 1.5, h: 2.4, d: 1.5, label: () => text, onUse: () => { onPress?.(); w.game.audio.confirm?.(); }, enabled: () => mine && (!enabled || enabled()), range: 3.6 });
  return st;
}

/** When I (only) enter this box my respawn point moves there. Non-synced on purpose: each of you respawns on your own lane. */
export function localMark(w, x, y, z, { w: ww = 4, d = 4 } = {}) {
  w.trigger({ x, y: y + 1.2, z, w: ww, h: 3, d, once: false, onEnter: () => { w.respawn = { x, y, z, yaw: 0 }; } });
}

/**
 * A run of islands joined by bridges that only stand while somebody holds a plate (the Icebreakers leapfrog, generalised).
 * islands: centre z of each island (x = ox). Bridge k joins island k-1 and k; its holder stands on the far plate of island k-1,
 * the crosser keeps it up from the near plate of island k. Roles alternate starting with `first`.
 */
export function leapfrog(w, { ox = 0, ys = 0, islands, first = 'p1', iw = 8, id = 8, bw = 3.6, path = true }) {
  const c = w.coop, N = c.names;
  const other = (r) => (r === 'p1' ? 'p2' : 'p1');
  const holder = (k) => ((k % 2 ? first : other(first)));
  const crosser = (k) => other(holder(k));
  const R = {}, F = {}, B = {};
  islands.forEach((z, i) => w.plat({ x: ox, y: ys, z, w: iw, d: id, tex: 'wood', path }));
  for (let k = 1; k < islands.length; k++) {
    R[k] = riser(w, { x: ox, y: ys, z: (islands[k - 1] + islands[k]) / 2, w: bw, d: islands[k - 1] - islands[k] - id, h: 0.6, drop: 7, color: 0xcdb48a, speed: 7 });
    F[k] = plate(w, { x: ox + 2.5, y: ys, z: islands[k - 1] - id / 2 + 1.8, need: holder(k), label: `${N[holder(k)]}: HOLD` });
    B[k] = plate(w, { x: ox - 2.5, y: ys, z: islands[k] + id / 2 - 1.8, need: crosser(k), label: `${N[crosser(k)]}: KEEP IT UP` });
  }
  w.updaters.push(() => { for (let k = 1; k < islands.length; k++) R[k].set(F[k].pressed || B[k].pressed); });
  const steps = (role) => {
    const out = [];
    for (let k = 1; k < islands.length; k++) {
      if (holder(k) === role) {
        out.push({ x: ox + 2.5, z: islands[k - 1] - id / 2 + 1.8, until: () => B[k].pressed });         // hold until the crosser is on the far plate
        out.push({ x: ox, z: islands[k], r: 1.5 });
      } else {
        out.push({ x: ox, z: islands[k - 1] - id / 2 - 0.4, r: 1.2, until: () => R[k].up });
        out.push({ x: ox, z: islands[k] + id / 2 - 0.8, r: 0.9 });                                  // straight over the bridge first
        out.push({ x: ox - 2.5, z: islands[k] + id / 2 - 1.8, until: () => { const P = c.partner; return P.has && P.sz < islands[k] + id / 2 - 0.6; } });
      }
    }
    return out;
  };
  return { R, F, B, holder, crosser, steps };
}

export { COL };
