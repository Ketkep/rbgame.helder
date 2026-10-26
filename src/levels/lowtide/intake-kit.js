import * as THREE from 'three';
import { horrorSurface } from './materials.js';
import { box } from './kit.js';

// Pieces for chapter 1 (Intake) that are general enough for other Lowtide chapters: a hold-to-use interaction with a progress bar, a few props
// (strap sets, a dose cabinet, a card reader, a wall console with a live screen, a tip-over trolley, a bar grille), and small helpers.

const M = {
  steel: () => new THREE.MeshStandardMaterial({ color: 0x8e9996, roughness: 0.42, metalness: 0.85 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x1b2024, roughness: 0.55, metalness: 0.7 }),
  leather: () => new THREE.MeshStandardMaterial({ color: 0x2b1d16, roughness: 0.6, metalness: 0.1 }),
  tray: () => new THREE.MeshStandardMaterial({ color: 0xa9b3ae, roughness: 0.35, metalness: 0.9 }),
};
const memo = new Map();
const mat = (k) => { if (!memo.has(k)) memo.set(k, M[k]()); return memo.get(k); };
const glow = (hex, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });
const put = (parent, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };

/** The hold-to-use bar (one per level). hud.show(label, k) draws it for ~0.15 s; hud.pressed() = is the use key / mouse down. */
export function makeHud(w, game) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:50%;top:60%;transform:translateX(-50%);width:250px;pointer-events:none;z-index:30;display:none;font:700 11px/1 Inter,system-ui,sans-serif;letter-spacing:.22em;color:#cfd8d2;text-align:center;text-shadow:0 0 6px #000';
  el.innerHTML = '<div></div><div style="margin-top:8px;height:5px;background:rgba(0,0,0,.65);border:1px solid #55625c"><i style="display:block;height:100%;width:0;background:#c9d3cc"></i></div>';
  document.body.appendChild(el);
  const [lab, bar] = [el.children[0], el.querySelector('i')];
  let until = 0, mouse = false;
  const dn = (e) => { if (e.button === 0) mouse = true; }, up = (e) => { if (e.button === 0) mouse = false; };
  window.addEventListener('mousedown', dn); window.addEventListener('mouseup', up);
  w.disposers.push(() => { el.remove(); window.removeEventListener('mousedown', dn); window.removeEventListener('mouseup', up); });
  const prev = w.hooks.frame;
  w.hooks.frame = (dt, g) => { prev?.(dt, g); const on = performance.now() < until; if (el.style.display !== (on ? 'block' : 'none')) el.style.display = on ? 'block' : 'none'; };
  return {
    show(label, k) { until = performance.now() + 160; lab.textContent = label; bar.style.width = `${Math.round(Math.max(0, Math.min(1, k)) * 100)}%`; },
    pressed: () => game.keys.has('KeyE') || mouse,
  };
}

/**
 * Press E (or the mouse) on it and KEEP holding. Progress `st.k` (0..1) rises while held (looking at it), falls when released.
 * o: { x, y, z, w, h, d, range, label: string|(st)=>string, enabled: (st)=>bool, secs, bar: label, onDone(st), tick(dt, st) (replaces the default progress) }
 * Test bots cannot hold keys: every useFocus() call from a bot counts as held for a moment.
 */
export function holdable(w, game, hud, o) {
  const st = { k: 0, held: false, last: -9, done: false, it: null };
  st.it = w.interactable({
    x: o.x, y: o.y ?? 1.1, z: o.z, w: o.w ?? 1, h: o.h ?? 1.2, d: o.d ?? 1, range: o.range ?? 3, pad: 0.1,
    label: () => (typeof o.label === 'function' ? o.label(st) : o.label),
    enabled: o.enabled ? () => o.enabled(st) : null,
    onUse: () => { st.last = w.t; },
  });
  w.updaters.push((dt) => {
    const on = !o.enabled || o.enabled(st);
    st.held = on && (window.__noRender ? w.t - st.last < 0.3 : hud.pressed() && game.focus === st.it);
    if (o.tick) o.tick(dt, st);
    else {
      if (st.held) st.k = Math.min(1, st.k + dt / (o.secs ?? 5)); else st.k = Math.max(0, st.k - (dt * 1.4) / (o.secs ?? 5));
      if (st.k >= 1 && !st.done) { st.done = true; o.onDone?.(st); }
    }
    if (on && !o.noBar && (st.held || st.k > 0.001) && !st.done) hud.show(o.bar ?? 'HOLD', st.k);
  });
  return st;
}

/** Leather restraints laid over a bed (visible until `set(false)`). Returns { group, set(on) }. */
export function straps(w, { x, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  for (const pz of [-0.3, 0.45]) put(g, new THREE.BoxGeometry(1.0, 0.04, 0.12), mat('leather'), 0, 0.73, pz);
  for (const px of [-0.46, 0.46]) for (const pz of [-0.6, 0.8]) { put(g, new THREE.BoxGeometry(0.1, 0.045, 0.2), mat('leather'), px, 0.7, pz); put(g, new THREE.BoxGeometry(0.05, 0.06, 0.05), mat('steel'), px, 0.74, pz); }
  return { group: g, set(on) { g.visible = !!on; } };
}

/** A wall cabinet (dose cabinet) with a keypad plate and a door that swings open. Faces +z (rot 0 = on a north wall looking south). */
export function cabinet(w, { x, y = 0, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  put(g, new THREE.BoxGeometry(1.5, 1.7, 0.45), horrorSurface('rust', { color: 0x5d6b66, roughness: 0.55, metalness: 0.7, bump: 1.6 }), 0, 1.35, 0);
  const door = new THREE.Group(); door.position.set(-0.72, 0, 0.23); g.add(door);
  put(door, new THREE.BoxGeometry(1.44, 1.62, 0.04), horrorSurface('rust', { color: 0x71807a, roughness: 0.5, metalness: 0.7, bump: 1.6 }), 0.72, 1.35, 0.02);
  for (let i = 0; i < 4; i++) put(door, new THREE.BoxGeometry(0.5, 0.02, 0.03), mat('dark'), 0.72, 1.7 + i * 0.07, 0.05);
  put(door, new THREE.BoxGeometry(0.36, 0.5, 0.05), mat('dark'), 1.2, 1.35, 0.05);                               // keypad plate
  const led = put(door, new THREE.BoxGeometry(0.26, 0.05, 0.02), glow(0xff3a2a, 1.8), 1.2, 1.5, 0.085);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) put(door, new THREE.BoxGeometry(0.06, 0.05, 0.02), glow(0xb8c4be, 0.5), 1.1 + c * 0.1, 1.38 - r * 0.07, 0.085);
  put(g, new THREE.BoxGeometry(1.3, 0.04, 0.35), mat('steel'), 0, 1.0, 0.02); put(g, new THREE.BoxGeometry(1.3, 0.04, 0.35), mat('steel'), 0, 1.6, 0.02);
  for (let i = 0; i < 5; i++) put(g, new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x6a4a1e : 0x4e5a2a, roughness: 0.3, transparent: true, opacity: 0.8 }), -0.5 + i * 0.25, 1.12, 0.02);
  w.collider({ x: x, y: y + 1.35, z: z + (rot === 0 ? 0 : 0), w: rot ? 0.5 : 1.5, h: 1.7, d: rot ? 1.5 : 0.5 });
  let open = 0, target = 0;
  w.updaters.push((dt) => { open += (target - open) * Math.min(1, dt * 3); door.rotation.y = -open * 1.9; });
  return { group: g, setOpen(v) { target = v ? 1 : 0; led.material = glow(v ? 0x3dff7a : 0xff3a2a, 1.8); } };
}

/** A key-card reader panel on a wall, facing +z at rot 0. Returns { led(hex) }. */
export function reader(w, { x, y = 1.25, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  put(g, new THREE.BoxGeometry(0.3, 0.46, 0.08), mat('dark'), 0, 0, 0);
  const slot = put(g, new THREE.BoxGeometry(0.2, 0.03, 0.02), glow(0x0a0e10, 1), 0, -0.04, 0.045);
  const led = put(g, new THREE.BoxGeometry(0.14, 0.05, 0.02), glow(0xff3a2a, 1.8), 0, 0.14, 0.045);
  void slot;
  return { led(hex) { led.material = glow(hex, 1.8); } };
}

/** A wall console with a live screen: draw(ctx, W, H) is called by `refresh()`. Faces +z at rot 0. */
export function consoleProp(w, { x, y = 0, z, rot = 0, title = 'CONSOLE', draw }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  put(g, new THREE.BoxGeometry(1.5, 1.0, 0.7), horrorSurface('rust', { color: 0x3c4742, roughness: 0.55, metalness: 0.75, bump: 1.5 }), 0, 0.5, 0);
  const slope = put(g, new THREE.BoxGeometry(1.5, 0.08, 0.7), mat('dark'), 0, 1.04, 0.0); slope.rotation.x = -0.35;
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 200; const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) }));
  screen.position.set(0, 1.55, -0.2); screen.rotation.x = -0.18; g.add(screen);
  put(g, new THREE.BoxGeometry(1.42, 0.92, 0.1), mat('dark'), 0, 1.55, -0.27);
  for (let i = 0; i < 6; i++) put(g, new THREE.BoxGeometry(0.12, 0.04, 0.12), glow(i % 2 ? 0xffb040 : 0x60e0a0, 0.9), -0.5 + i * 0.2, 1.08 + 0.02, 0.1 - 0.0);
  const key = put(g, new THREE.BoxGeometry(0.14, 0.14, 0.14), mat('steel'), 0.55, 1.12, 0.22);
  void key;
  w.collider({ x, y: y + 0.9, z, w: Math.abs(Math.cos(rot)) > 0.7 ? 1.5 : 0.7, h: 1.8, d: Math.abs(Math.cos(rot)) > 0.7 ? 0.7 : 1.5 });
  const refresh = () => { ctx.fillStyle = '#04100c'; ctx.fillRect(0, 0, 320, 200); draw(ctx, 320, 200); tex.needsUpdate = true; };
  refresh();
  return { group: g, refresh, title };
}

/** A hospital trolley with a tray of instruments that can be knocked over (the noise lures the Orderly). */
export function trolley(w, { x, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; w.add(g);
  put(g, new THREE.BoxGeometry(0.8, 0.04, 0.5), mat('steel'), 0, 0.82, 0); put(g, new THREE.BoxGeometry(0.7, 0.03, 0.42), mat('steel'), 0, 0.3, 0);
  for (const [px, pz] of [[-0.36, -0.2], [0.36, -0.2], [-0.36, 0.2], [0.36, 0.2]]) { put(g, new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), mat('steel'), px, 0.42, pz); put(g, new THREE.SphereGeometry(0.045, 8, 6), mat('dark'), px, 0.04, pz); }
  const tray = new THREE.Group(); tray.position.set(0, 0.86, 0); g.add(tray);
  put(tray, new THREE.BoxGeometry(0.6, 0.02, 0.36), mat('tray'), 0, 0, 0);
  for (let i = 0; i < 5; i++) { const s = put(tray, new THREE.BoxGeometry(0.02, 0.012, 0.2 + (i % 2) * 0.05), mat('tray'), -0.22 + i * 0.1, 0.02, 0.0); s.rotation.y = (i - 2) * 0.12; }
  put(tray, new THREE.CylinderGeometry(0.05, 0.04, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x9aa39a, roughness: 0.4, transparent: true, opacity: 0.8 }), 0.2, 0.06, 0.1);
  w.collider({ x, y: 0.45, z, w: Math.abs(Math.cos(rot)) > 0.7 ? 0.85 : 0.55, h: 0.9, d: Math.abs(Math.cos(rot)) > 0.7 ? 0.55 : 0.85 });
  let fall = 0, falling = false, rest = false;
  return {
    group: g, tray,
    tip() { falling = true; fall = 0; rest = false; },
    update(dt) { if (!falling) return; fall += dt; const k = Math.min(1, fall * 2.4); tray.position.y = 0.86 - k * 0.84; tray.rotation.z = k * 0.4; tray.rotation.x = k * 0.3; if (k >= 1) { falling = false; rest = true; } },
    get fallen() { return rest || falling; },
  };
}

/** Floor-to-ceiling vertical bars filling a doorway-sized gap (a window you can see through but not pass). Solid. */
export function grille(w, { x, z, along = 'z', width = 2.0, h = 2.6 }) {
  const n = Math.round(width / 0.16);
  for (let i = 0; i <= n; i++) {
    const o = -width / 2 + (width * i) / n;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h, 6), mat('dark')); m.position.set(along === 'z' ? x : x + o, h / 2, along === 'z' ? z + o : z); m.castShadow = true; w.add(m);
  }
  for (const yy of [0.5, 1.3, 2.1, h]) { const r = new THREE.Mesh(new THREE.BoxGeometry(along === 'z' ? 0.06 : width, 0.05, along === 'z' ? width : 0.06), mat('dark')); r.position.set(x, yy, z); w.add(r); }
  w.collider({ x, y: h / 2, z, w: along === 'z' ? 0.3 : width, h, d: along === 'z' ? width : 0.3 });
  void box;
}

/** A small hand torch lying on a table (hidden when taken). */
export function torchProp(w, { x, y, z, rot = 0 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; w.add(g);
  const b = put(g, new THREE.CylinderGeometry(0.03, 0.026, 0.22, 10), mat('dark'), 0, 0.03, 0); b.rotation.z = Math.PI / 2;
  const h = put(g, new THREE.CylinderGeometry(0.045, 0.034, 0.07, 10), mat('steel'), 0.14, 0.03, 0); h.rotation.z = Math.PI / 2;
  const lens = put(g, new THREE.CircleGeometry(0.04, 12), glow(0xfff0c8, 0.8), 0.176, 0.03, 0); lens.rotation.y = Math.PI / 2;
  return g;
}

/** Draw a simple console screen line set. */
export function screenText(ctx, W, H, lines, { color = '#7dffb8', size = 22 } = {}) {
  ctx.fillStyle = color; ctx.font = `700 ${size}px monospace`; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, 14, 14 + i * (size + 8)));
  void W; void H;
}
