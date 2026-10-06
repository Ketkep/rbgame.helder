import * as THREE from 'three';
import { plainMaterial, glowMaterial } from '../../engine/materials.js';
import { hotelEnv, lobbyShell, L, GOLD } from './kit.js';
import { sofa, coffeeTable, elevatorBank } from './props.js';
import { onPlat } from '../common.js';

// Hotel level 1 — "Wet Floor" (Easy · Mezzanine). The cleaning staff mopped the lobby. All of it.
// The floor is lethal; hop across the furniture and climb the cocktail tables to the mezzanine.

const gold = (r = 0.28) => plainMaterial(GOLD, { metalness: 1, roughness: r });

export default {
  id: 'hotel-1',
  name: 'Wet Floor',
  music: 'hotel',
  completeQuip: 'The marble is very proud of you. I\'m... fine.',

  build(w, game) {
    hotelEnv(w);
    lobbyShell(w);
    elevatorBank(w, game.campaign.tiers, { cars: false });
    w.spawn = { x: 0, y: 0.3, z: 12.5, yaw: 0 };
    w.respawn = { ...w.spawn };
    w.killY = -30;

    // ---- the floor is (very) wet ---------------------------------------------------------------
    const slip = w.hazard({ x: 0, y: 0.1, z: -4, w: 43.5, h: 0.2, d: 39.5, color: 0x3a6aa8 });
    slip.core.material.opacity = 0.16; slip.shell.visible = false;
    const sheen = new THREE.Mesh(new THREE.PlaneGeometry(43, 39), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7ab8ff).multiplyScalar(0.9), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
    sheen.rotation.x = -Math.PI / 2; sheen.position.set(0, 0.045, -4); w.add(sheen);
    w.onUpdate((dt, t) => { sheen.material.opacity = 0.09 + Math.sin(t * 1.3) * 0.025; });
    for (const [x, z, r] of [[-6, 8, 0.6], [6, 6, -0.4], [-8, -3, 0.2], [8, -6, 2.4], [-5, -13, -0.7], [6, -16, 1.1], [-12, 10, 0.3], [12, 2, 3.8], [-9, -9, 1.7], [10, -12, 0.9]]) wetSign(w, x, z, r);

    // ---- the route ----------------------------------------------------------------------------
    const pole = (x, z, top, ww, dd) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) w.box({ x: x + sx * (ww / 2 - 0.15), y: (top - 0.1) / 2, z: z + sz * (dd / 2 - 0.15), w: 0.1, h: top - 0.1, d: 0.1, color: GOLD, metal: 1, rough: 0.28, shadow: true }); };
    const path = (p) => { p.o.path = true; return p; };
    // 0: welcome mat
    const P0 = path(w.plat({ x: 0, y: 0.3, z: 12.5, w: 4, d: 3, h: 0.3, tex: 'carpet', color: 0xffffff, roughness: 0.9, radius: 0.04 }));
    w.sign({ text: 'WELCOME', x: 0, y: 0.32, z: 12.5, w: 3.2, h: 0.9, rotX: -Math.PI / 2, color: '#f1d28a', double: false, tw: 512, size: 70 });
    // 1: suitcase pile
    w.plat({ x: -2.8, y: 0.5, z: 9.4, w: 1.9, d: 1.4, h: 0.5, tex: 'leather', color: 0x4a2a1a, roughness: 0.5, radius: 0.08 });
    const P1 = path(w.plat({ x: -2.8, y: 0.9, z: 9.4, w: 1.6, d: 1.2, h: 0.4, tex: 'leather', color: 0x1a2a4a, roughness: 0.5, radius: 0.08 }));
    // 2: ottoman
    const P2 = path(w.plat({ x: -0.6, y: 0.45, z: 6.4, w: 1.5, d: 1.5, h: 0.4, tex: 'leather', color: 0x7a1030, roughness: 0.45, radius: 0.15 }));
    pole(-0.6, 6.4, 0.45, 1.5, 1.5);
    // 3: sofa
    const P3 = path(sofa(w, 2.6, 3.4, 0, { color: 0x10342b, len: 3.2 }).seat);
    // 4: coffee table
    const P4 = path(coffeeTable(w, -0.6, 0.6, { w: 1.8, d: 1.0, h: 0.6 }));
    // 5: brass trolley
    const trolley = (x, z, top, ww, dd) => {
      const deck = path(w.plat({ x, y: top, z, w: ww, d: dd, h: 0.1, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.03 }));
      pole(x, z, top, ww, dd);
      w.plat({ x, y: 0.3, z, w: ww - 0.1, d: dd - 0.1, h: 0.06, tex: 'brass', color: 0xffffff, roughness: 0.3, metalness: 0.9, radius: 0.02, collide: false });
      return deck;
    };
    const P5 = trolley(-4.0, -2.4, 1.0, 1.5, 1.5);
    // 6: the grand piano lid (checkpoint)
    const P6 = path(w.plat({ x: -0.2, y: 1.2, z: -5.4, w: 2.8, d: 1.7, h: 0.18, tex: 'wood', color: 0x15151a, roughness: 0.08, radius: 0.08 }));
    for (const [sx, sz] of [[-1, -0.55], [1, -0.55], [0, 0.65]]) w.box({ x: -0.2 + sx, y: 0.55, z: -5.4 + sz, w: 0.14, h: 1.1, d: 0.14, color: 0x0b0b10, rough: 0.1 });
    w.checkpoint({ x: -0.2, y: 1.2, z: -5.4, real: true });
    // 7: another trolley
    const P7 = trolley(3.4, -8.6, 1.5, 1.8, 1.2);
    // 8: reception-style desk
    const P8 = path(w.plat({ x: -0.6, y: 1.7, z: -11.6, w: 4.0, d: 1.2, h: 0.2, tex: 'marble', color: 0xffffff, roughness: 0.08, radius: 0.04 }));
    w.plat({ x: -0.6, y: 1.5, z: -11.6, w: 3.8, d: 1.0, h: 1.2, tex: 'wood', color: 0xffffff, roughness: 0.3, radius: 0.05 });
    // 9-13: the cocktail-table climb
    const table = (x, z, top) => {
      const t = path(w.plat({ x, y: top, z, w: 1.7, d: 1.7, h: 0.12, tex: 'marble', color: 0xffffff, roughness: 0.08, radius: 0.05 }));
      w.box({ x, y: (top - 0.12) / 2, z, w: 0.18, h: top - 0.12, d: 0.18, color: GOLD, metal: 1, rough: 0.28 });
      w.box({ x, y: 0.05, z, w: 1.0, h: 0.1, d: 1.0, color: GOLD, metal: 1, rough: 0.3 });
      return t;
    };
    const climb = [[3.0, -14.2, 2.7], [-0.4, -16.2, 3.7], [3.0, -18.0, 4.7], [-0.4, -19.8, 5.7], [3.0, -21.4, 6.6]].map(([x, z, t]) => table(x, z, t));
    // mezzanine balcony with the goal
    const balc = path(w.plat({ x: 0, y: 7.5, z: -22.9, w: 24, d: 1.8, h: 0.6, tex: 'marble', color: 0xffffff, roughness: 0.15, radius: 0.05 }));
    for (const x of [-12, -6, 0, 6, 12]) w.box({ x, y: 3.6, z: -22.9, w: 0.5, h: 7.2, d: 0.5, color: 0xece3cf, rough: 0.3 });
    w.box({ x: 0, y: 8.05, z: -22.1, w: 24, h: 0.08, d: 0.08, color: GOLD, metal: 1, rough: 0.28, shadow: false });
    w.box({ x: 0, y: 7.7, z: -22.1, w: 24, h: 0.08, d: 0.08, color: GOLD, metal: 1, rough: 0.28, shadow: false });
    w.sign({ text: 'MEZZANINE · STAFF ONLY', x: 0, y: 7.52, z: -22.0, w: 5, h: 0.5, rotX: -Math.PI / 2, color: '#f1d28a', double: false, tw: 1024, size: 50 });
    w.goal({ x: 0, y: 7.5, z: -22.9, color: GOLD, onReach: () => { game.say('hotel.l1.done', { priority: 2 }); game.completeLevel(); } });

    // ---- the host has opinions ------------------------------------------------------------------
    let intro = false, t = 0;
    w.hooks.frame = (dt, g) => {
      if (g.state !== 'playing') return;
      t += dt;
      if (!intro && t > 1.3) { intro = true; g.say('hotel.l1.intro'); g.say('hotel.l1.intro2'); }
    };
    onPlat(w, P2, () => game.say('hotel.l1.1'));
    onPlat(w, P6, () => game.say('hotel.l1.mid'));
    onPlat(w, P8, () => game.say('hotel.l1.up'));
    onPlat(w, climb[2], () => game.say('hotel.l1.near'));
    w.hooks.onDeath = () => {
      if (Math.random() < 0.7) { game.say('hotel.l1.slip', { priority: 1 }); return true; }
      return false;
    };
    void P0; void P1; void P3; void P4; void P5; void P7; void balc;
  },
};

// a yellow A-frame "WET FLOOR" sign lying on the (lethal) floor
function wetSign(w, x, z, rot) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 384; const g = c.getContext('2d');
  g.fillStyle = '#ffd21f'; g.fillRect(0, 0, 256, 384);
  g.fillStyle = '#111'; g.font = '700 54px Arial Black, Impact, sans-serif'; g.textAlign = 'center';
  g.fillText('CAUTION', 128, 80); g.font = '700 70px Arial Black, Impact, sans-serif'; g.fillText('WET', 128, 190); g.fillText('FLOOR', 128, 270);
  g.beginPath(); g.moveTo(128, 296); g.lineTo(168, 368); g.lineTo(88, 368); g.closePath(); g.fillStyle = '#111'; g.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, side: THREE.DoubleSide });
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = rot;
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.7), mat); p.position.set(0, 0.35, s * 0.17); p.rotation.x = s * -0.32; p.castShadow = true; grp.add(p); }
  w.add(grp);
}
