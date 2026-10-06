import * as THREE from 'three';
import { glowMaterial, plainMaterial } from '../../engine/materials.js';
import { hotelEnv, lobbyShell, L, ELEV_X, GOLD } from './kit.js';
import { sofa, armchair, coffeeTable, rug, palm, piano, reception, luggageCart, elevatorBank } from './props.js';

// The hub: a walkable art-deco lobby. Its five elevators are the level select (one elevator per floor/tier).

export default {
  id: 'hotel-lobby',
  name: 'Lobby',
  hub: true,
  music: 'hotel',
  titleCam: { center: [0, 3, -4], radius: 14, height: 4 },

  build(w, game) {
    hotelEnv(w);
    w.stepHeight = 0.45;
    w.killY = -60;
    w.isHub = true;
    const camp = game.campaign, cs = game.cs();
    const tiers = camp.tiers;

    lobbyShell(w);

    // ---- furnishings -----------------------------------------------------------------------------
    // east lounge
    rug(w, 14.5, -3, 8.5, 7, 0x10342b);
    sofa(w, 14.5, -6.6, 2, { color: 0x7a1030 });
    sofa(w, 14.5, 0.6, 0, { color: 0x7a1030 });
    coffeeTable(w, 14.5, -3);
    armchair(w, 19.3, -3, 3, { color: 0xb08a3a });
    armchair(w, 9.7, -3, 1, { color: 0xb08a3a });
    piano(w, 15.6, 10.2, game);
    // west: reception + a waiting corner
    reception(w, game);
    rug(w, -15, 11, 6, 4.5, 0x6b0f24);
    sofa(w, -15, 12.6, 0, { color: 0x10342b, len: 3 });
    armchair(w, -18.8, 10.2, 1, { color: 0x7a1030 });
    // luggage near the doors
    luggageCart(w, 7.8, 12.2, 0);
    luggageCart(w, -7.4, 12.8, 0);
    // greenery
    for (const [x, z, s] of [[-20.2, 14.2, 1.1], [20.2, 14.2, 1.1], [-20.4, -21.6, 1.15], [20.4, -21.6, 1.15], [-7.5, -21.8, 0.9], [7.5, -21.8, 0.9], [20.4, 6.2, 0.9]]) palm(w, x, z, s);

    entrance(w);
    w.sign({ text: 'ELEVATORS', x: 0, y: 9.6, z: L.z0 + 0.2, w: 11, h: 1.9, color: '#ffe3a0', glow: 1.5, glowColor: '#d8a94a', tw: 1024 });
    w.sign({ text: 'Express to every floor except the one you want', x: 0, y: 8.2, z: L.z0 + 0.2, w: 12, h: 0.7, color: '#d8c090', glow: 1.0, tw: 1024, size: 40 });
    w.sign({ text: 'HOTEL TRUST-ME', x: 0, y: 9.4, z: L.z1 - 0.2, w: 11, h: 1.9, color: '#ffe3a0', glow: 1.5, glowColor: '#d8a94a', tw: 1024, rotY: Math.PI });

    // ---- elevators -------------------------------------------------------------------------------
    const E = elevatorBank(w, tiers, { cars: true });
    const state = { busy: false, shaking: false, lied: false };
    const tierUnlocked = (t) => game.isUnlocked(t * 5);
    E.forEach((e, i) => {
      e.open = 0; e.target = 0;
      w.mover(e.leafL, () => ({ x: -e.open * 1.5 }));
      w.mover(e.leafR, () => ({ x: e.open * 1.5 }));
      const ok = tierUnlocked(i);
      // outside call button
      w.interactable({
        x: e.x + 2.3, y: 1.5, z: L.z0 + 0.3, w: 0.7, h: 0.9, d: 0.8,
        label: () => (!tierUnlocked(i) ? 'Out of order' : e.target ? 'Doors open' : `Call elevator · Floor ${tiers[i].floor}`),
        onUse: (g) => {
          if (!tierUnlocked(i)) { g.audio.buzzer(); g.say('hotel.out_of_order', { priority: 2 }); return; }
          if (!e.target) { e.target = 1; g.audio.ding(); }
        },
      });
      e.lampMat.color.set(ok ? 0x40ff80 : 0xff3030).multiplyScalar(2.6);
      // the buttons inside the car
      const car = e.car;
      for (let j = 0; j < 5; j++) {
        const k = i * 5 + j, lv = camp.levels[k];
        const by = 1.15 + j * 0.46;
        const unlocked = game.isUnlocked(k);
        const col = lv.placeholder ? 0xffb030 : unlocked ? 0x40ff80 : 0xff3030;
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16), glowMaterial(col, 1.25)); b.rotation.x = Math.PI / 2; b.position.set(e.x - 1.0, by, car.zBack + 0.1); w.add(b);
        w.sign({ text: `${k + 1}.  ${lv.name}${lv.placeholder ? '  ·  renovating' : unlocked ? '' : '  ·  locked'}`, x: e.x + 0.45, y: by, z: car.zBack + 0.1, w: 2.3, h: 0.34, color: lv.placeholder ? '#ffc060' : unlocked ? '#e8ffe8' : '#ff9090', align: 'left', tw: 1024, size: 48, glow: 1.1 });
        w.interactable({
          x: e.x - 0.2, y: by, z: car.zBack + 0.25, w: 3.0, h: 0.4, d: 0.5, range: 3.6, pad: 0.02,
          label: () => `Level ${k + 1}: ${lv.name}${lv.placeholder ? ' (under renovation)' : game.isUnlocked(k) ? '' : ' (locked)'}`,
          onUse: (g) => {
            if (state.busy) return;
            if (lv.placeholder) { g.audio.buzzer(); g.say('hotel.renovation', { priority: 2 }); return; }
            if (!g.isUnlocked(k)) { g.audio.buzzer(); g.say('hotel.locked_level', { priority: 2 }); return; }
            ride(g, e, k, i);
          },
        });
      }
      w.sign({ text: `FLOOR ${tiers[i].floor} — ${tiers[i].name.toUpperCase()}`, x: e.x, y: 3.4, z: car.zBack + 0.1, w: 3.0, h: 0.45, bg: '#0c0c10', color: '#' + tiers[i].color.toString(16).padStart(6, '0'), border: '#d8a94a', size: 30, tw: 1024 });
    });

    function ride(g, e, k, tierIdx) {
      state.busy = true;
      e.target = 0; g.audio.door();
      w.after(1.5, () => { g.ui.fade(true, 700); g.audio.rumble(2.6); state.shaking = true; g.say('hotel.elevator.go', { priority: 2 }); });
      const lie = tierIdx >= 1 && !state.lied && Math.random() < 0.25;
      if (lie) {
        state.lied = true;
        w.after(4.3, () => { state.shaking = false; g.ui.fade(false, 500); g.audio.ding(); e.target = 1; g.say('hotel.elevator.lie', { priority: 2 }); state.busy = false; });
      } else w.after(4.4, () => { state.shaking = false; g.enterLevel(k); });
    }
    w.onUpdate((dt) => {
      for (const e of E) { const d = e.target - e.open; e.open += Math.max(-dt / 1.1, Math.min(dt / 1.1, d)); }
      if (state.shaking) game.shake = Math.max(game.shake, 0.22);
    });

    // ---- more interactables ----------------------------------------------------------------------
    w.interactable({ x: 0, y: 2.2, z: L.z1 - 0.5, w: 6, h: 4.4, d: 1.6, range: 4, label: 'Check out', onUse: (g) => { g.audio.lock(); g.say('hotel.doors', { priority: 1 }); } });

    // ---- where you start --------------------------------------------------------------------------
    const arr = game.hubArrival;
    if (arr !== null && arr !== undefined && E[arr]) {
      const car = E[arr].car;
      w.spawn = { x: E[arr].x, y: 0, z: car.zc + 0.6, yaw: Math.PI };
      w.after(0.9, () => { E[arr].target = 1; game.audio.ding(); game.say('hotel.return', { priority: 1 }); });
      if (cs.levelBest[0] && !cs.sawFirstClear) { cs.sawFirstClear = true; w.after(5, () => game.say('hotel.complete.first', { priority: 1 })); }
    } else {
      w.spawn = { x: 0, y: 0, z: 13, yaw: 0 };
      w.after(1.6, () => { game.say('hotel.welcome'); game.say('hotel.welcome2'); });
    }
    w.respawn = { ...w.spawn };
  },
};

// ---- the front doors: brass frames, night-blue glass, a slowly turning revolving door (locked) ----
function entrance(w) {
  const gold = plainMaterial(GOLD, { metalness: 1, roughness: 0.28 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a5a, emissive: 0x1a2f6a, emissiveIntensity: 0.9, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.2 });
  for (const sx of [-1, 1]) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.6, 0.08), glass); pane.position.set(sx * 1.5, 3.0, 16.0); w.add(pane);
    for (const fx of [-1.4, 0, 1.4]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 5.6, 0.12), gold); bar.position.set(sx * 1.5 + fx, 3.0, 15.96); w.add(bar); }
    for (const fy of [0.2, 2.2, 5.7]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.1, 0.12), gold); bar.position.set(sx * 1.5, fy, 15.96); w.add(bar); }
  }
  // revolving drum
  const g = new THREE.Group(); g.position.set(0, 0, 14.4);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 3.2, 28, 1, true, 0.35, Math.PI - 0.7), glass); drum.position.y = 1.8; drum.material.side = THREE.DoubleSide; g.add(drum);
  const drum2 = drum.clone(); drum2.rotation.y = Math.PI; g.add(drum2);
  for (const a of [0.35, Math.PI - 0.35, Math.PI + 0.35, Math.PI * 2 - 0.35]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8), gold); post.position.set(Math.cos(a) * 2.1, 1.7, Math.sin(a) * 2.1); g.add(post); }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.2, 28), gold); top.position.y = 3.5; g.add(top);
  const wings = new THREE.Group(); wings.position.y = 1.7;
  for (let i = 0; i < 4; i++) { const wing = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.2, 2.0), glass); wing.position.set(0, 0, 1.0); const holder = new THREE.Group(); holder.rotation.y = (i * Math.PI) / 2; holder.add(wing); wings.add(holder); }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 10), gold); wings.add(axle);
  g.add(wings); w.add(g);
  w.onUpdate((dt) => { wings.rotation.y += dt * 0.35; });
  w.collider({ x: 0, y: 3, z: 15.2, w: 6.4, h: 6, d: 1.4 });
}
