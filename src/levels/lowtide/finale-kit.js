import * as THREE from 'three';
import { softTexture } from '../../engine/materials.js';
import { hp, box, wall, door } from './kit.js';
import { horrorSurface } from './materials.js';

// Chapter 8 (Lowtide, the finale) toolkit: a hand-cranked bridge, a hold-to-open shutter, a four-dial keypad, the choice-timer HUD, the full-screen
// ending cards, a dawn pier. Everything state-like goes through w.coop so both machines agree.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

/** A bridge that is extended while ANYONE holds ANY of its crank stations (either end will do, so one of you crosses while the other holds). */
export function crankBridge(w, HY, H, { x, y, z, len, wd = 2.4, axis = 'z', stations, drop = 3.2, kind = 'rust' }) {
  const p = hp(w, { x, z, y, w: axis === 'x' ? len : wd, d: axis === 'x' ? wd : len, h: 0.5, kind, color: 0x5d6b66, rough: 0.6, bump: 1.6, path: false, moving: true });
  const edgeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 1.3), toneMapped: false });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? len - 0.1 : 0.05, 0.02, axis === 'x' ? 0.05 : len - 0.1), edgeM);
    e.position.set(axis === 'x' ? 0 : sx * (wd / 2 - 0.1), 0.26, axis === 'x' ? sx * (wd / 2 - 0.1) : 0); p.group.add(e);
  }
  const B = { k: 0, p, sts: stations.map((s) => HY.station(s)), want: false };
  const by = p.base.y;
  w.updaters.push((dt) => {
    const want = B.sts.some((s) => s.zone.active); B.want = want;
    const was = B.k, tgt = want ? 1 : 0;
    B.k += Math.sign(tgt - B.k) * Math.min(Math.abs(tgt - B.k), dt / (want ? 1.3 : 2.6));
    p.setPos(p.base.x, by - (1 - B.k) * drop, p.base.z); p.body.enabled = B.k > 0.04;
    for (const s of B.sts) { s.wheel.rotation.z += dt * (s.zone.active ? 2.4 : 0); s.padM.color.setHex(0xffb040).multiplyScalar(s.zone.active ? 1.8 : 0.8); s.setProg(B.k); }
    if (Math.abs(B.k - was) > 1e-4 && want) { B.snd = (B.snd || 0) - dt; if (B.snd <= 0) { B.snd = 0.9; H.S.groan(0.08); } }
  });
  B.out = () => B.k > 0.95;
  return B;
}

/** A shutter in a corridor: open while anyone stands on any of its two pads (one each side), otherwise it slams shut. */
export function shutter(w, game, HY, H, { x = 0, y = 0, z, key, near, far, cw = 6 }) {
  const c = w.coop;
  const gap = 2.6, side = (cw - gap) / 2, h = 3.6;
  for (const s of [-1, 1]) wall(w, { x: x + s * (gap / 2 + side / 2), z, w: side + 0.2, d: 0.4, y, h, kind: 'tile' });
  box(w, { x, y: y + 2.5 + (h - 2.5) / 2, z, w: gap, h: h - 2.5, d: 0.4, kind: 'tile' });
  const D = door(w, { x, y, z, along: 'x', width: gap, h: 2.5, key, locked: true, label: 'shutter', slam: true, game });
  const A = HY.station(near), B = HY.station(far);
  let was = false, hold = 0;
  w.updaters.push((dt) => {
    const want = A.zone.active || B.zone.active;
    if (want) hold = 1.2; else hold = Math.max(0, hold - dt);
    const open = want || hold > 0 || D.forced > 0;
    if (D.forced > 0) D.forced -= dt;
    if (c.isHost && open !== was) { was = open; D.setOpen(open); }
    for (const s of [A, B]) { s.wheel.rotation.z += dt * (s.zone.active ? 2.8 : 0); s.padM.color.setHex(0xffb040).multiplyScalar(s.zone.active ? 1.9 : 0.8); s.setProg(D.k); }
  });
  D.forced = 0; D.A = A; D.B = B; D.z = z;
  return D;
}

/** A wall keypad with four dials. State { v: [a,b,c,d] } is shared; `onSolved` runs on both machines once the code matches; `onWrong` when a full wrong code is set. */
export function dialPad(w, game, { x, y = 1.5, z, rot = 0, code, onSolved, label = 'STACK · EAST DOOR' }) {
  const c = w.coop, key = 'ch8:code';
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 0.12), horrorSurface('rust', { color: 0x2c3532, roughness: 0.5, metalness: 0.8, bump: 1.4 })); g.add(panel);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.64), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) })); scr.position.z = 0.07; g.add(scr);
  let vals = [0, 0, 0, 0], solved = false;
  const draw = () => {
    ctx.fillStyle = '#050e0b'; ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = solved ? '#58f0a0' : '#5aa08a'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, 500, 180);
    ctx.font = '700 120px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = solved ? '#7dffb8' : '#c8ffe4';
    vals.forEach((v, i) => ctx.fillText(String(v), 70 + i * 124, 104));
    ctx.font = '700 22px monospace'; ctx.fillStyle = '#6fb89c'; ctx.fillText(solved ? 'SEATED' : label, 256, 26);
    tex.needsUpdate = true;
  };
  draw();
  const apply = (v) => {
    if (!v || solved) return; vals = v.slice(); draw();
    if (vals.every((d, i) => d === code[i])) { solved = true; draw(); onSolved?.(); }
  };
  c.on(key, apply);
  const bump = (i) => {
    if (solved) return;
    const cur = (c.get(key, null) || [0, 0, 0, 0]).slice(); cur[i] = (cur[i] + 1) % 10; c.set(key, cur);
    w.H?.S.step(0, 0.05);
  };
  if (window.__noRender) w.updaters.push(() => { const g = game.player; if (!solved && Math.hypot(g.x - x, g.z - z) < 3.2) c.set(key, code.slice()); });   // test bots cannot aim at a dial
  for (let i = 0; i < 4; i++) {
    const wx = -0.62 + i * 0.413;
    const px = x + Math.cos(rot) * wx, pz = z - Math.sin(rot) * wx, ox = Math.sin(rot) * 0.35, oz = Math.cos(rot) * 0.35;
    w.interactable({ x: px + ox, y, z: pz + oz, w: 0.38, h: 0.8, d: 0.38, range: 3, label: () => (solved ? 'Dial (seated)' : `Turn dial ${i + 1} (${vals[i]})`), enabled: () => !solved, onUse: () => bump(i) });
  }
  return { get solved() { return solved; }, g };
}

/** The ticking choice HUD (a thin bar at the top). set(label, seconds|null, urgent). */
export function timerHud(w) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:50%;top:7%;transform:translateX(-50%);z-index:35;pointer-events:none;text-align:center;font:700 13px "Archivo Black",Impact,sans-serif;letter-spacing:.3em;color:#d6e4de;text-shadow:0 0 8px #000;display:none';
  el.innerHTML = '<div id="c8-t-l"></div><div id="c8-t-n" style="font-size:34px;letter-spacing:.12em;margin-top:6px"></div>';
  document.body.appendChild(el);
  const [l, n] = [el.querySelector('#c8-t-l'), el.querySelector('#c8-t-n')];
  w.disposers.push(() => el.remove());
  return {
    set(label, sec, urgent) { el.style.display = 'block'; l.textContent = label; n.textContent = sec == null ? '' : `${Math.floor(sec / 60)}:${String(Math.max(0, Math.ceil(sec) % 60)).padStart(2, '0')}`; n.style.color = urgent ? '#ff5a4a' : '#d6e4de'; },
    hide() { el.style.display = 'none'; },
  };
}

/** Full-screen ending cards. play([{ t: 'text', ms, who?, bg? }]) -> Promise. Cards fade over the live world; bg 0..1 is how black the screen is. */
export function cardOverlay(w) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:70;pointer-events:none;display:none;background:#000;opacity:0;transition:opacity 1.6s ease';
  el.innerHTML = '<div id="c8-who" style="position:absolute;left:0;right:0;top:15%;text-align:center;font:700 12px \'Archivo Black\',Impact,sans-serif;letter-spacing:.5em;color:#8aa098"></div><div id="c8-txt" style="position:absolute;left:12%;right:12%;top:50%;transform:translateY(-50%);text-align:center;font:400 26px/1.55 Georgia,serif;color:#dfe8e2;opacity:0;transition:opacity 1.2s ease;text-shadow:0 0 12px #000"></div>';
  document.body.appendChild(el);
  const txt = el.querySelector('#c8-txt'), who = el.querySelector('#c8-who');
  w.disposers.push(() => el.remove());
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  return {
    el,
    async play(cards, { skip } = {}) {
      el.style.display = 'block'; await wait(30);
      for (const cd of cards) {
        if (skip?.()) break;
        if (cd.bg !== undefined) el.style.opacity = String(cd.bg);
        who.textContent = cd.who || '';
        txt.style.color = cd.color || '#dfe8e2'; txt.style.opacity = '0'; await wait(cd.bg !== undefined ? 700 : 60);
        txt.innerHTML = cd.t || ''; txt.style.opacity = cd.t ? '1' : '0';
        await wait(cd.ms ?? 4200);
        txt.style.opacity = '0'; await wait(900);
      }
    },
    fade(bg, ms = 1600) { el.style.display = 'block'; el.style.transition = `opacity ${ms}ms ease`; requestAnimationFrame(() => { el.style.opacity = String(bg); }); },
    hide() { el.style.display = 'none'; },
  };
}

/** A wooden pier with rails running out over a calm grey-gold sea under a dawn sky, behind the sea door. Everything is lit by its own lights and the backdrop glows. */
export function pier(w, { x = 0, y = 5, z0, len = 50, wd = 12 }) {
  const zc = z0 - len / 2;
  const pl = hp(w, { x, z: zc, y, w: wd, d: len, h: 1.2, kind: 'lino', color: 0x8a7a66, rough: 0.9, bump: 1.8, path: false });
  void pl;
  for (let zz = z0 - 2; zz > z0 - len; zz -= 3) for (const s of [-1, 1]) box(w, { x: x + s * (wd / 2 - 0.1), y: y + 0.5, z: zz, w: 0.1, h: 1.0, d: 0.1, kind: 'wood', shadow: false });
  for (const s of [-1, 1]) box(w, { x: x + s * (wd / 2 - 0.1), y: y + 1.0, z: zc, w: 0.08, h: 0.06, d: len, kind: 'wood', shadow: false });
  // the sea: a big flat plane with a warm sheen, the sky: a gradient backdrop with a sun disc
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x24363a, roughness: 0.18, metalness: 0.5, emissive: 0x1a1a14, emissiveIntensity: 0.8 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(x, y - 1.5, z0 - 440); w.add(sea);
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 256; const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2c3d57'); gr.addColorStop(0.55, '#a8806c'); gr.addColorStop(0.78, '#f2c58b'); gr.addColorStop(1, '#ffe7b8');
  g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1400, 420), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false, fog: false, color: new THREE.Color(1.1, 1.05, 1.0) }));
  sky.position.set(x, y + 120, z0 - 700); w.add(sky);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0xffd9a0, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
  sun.scale.setScalar(160); sun.position.set(x, y + 6, z0 - 690); w.add(sun);
  const L = new THREE.DirectionalLight(0xffd7a8, 0); L.position.set(x, y + 20, z0 - 80); w.add(L); w.add(L.target); L.target.position.set(x, y, z0 - 20);
  return { sea, sky, sun, light: L };
}
