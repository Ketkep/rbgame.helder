import { retreatEnv, deck, plate, gate, sign, lake } from './kit.js';

export default {
  id: 'coop1', name: 'Icebreakers', music: 'l1', deathRule: 'self',
  completeQuip: 'Great! You touched each other\'s plates. Growth.',
  titleCam: { center: [0, 1, -20], radius: 20, height: 7 },
  build(w, game) {
    retreatEnv(w);
    w.spawn = { x: -1.5, y: 0, z: 4, yaw: 0 }; w.respawn = { ...w.spawn };
    deck(w, { x: 0, y: 0, z: -4, w: 16, d: 24, path: true });
    const c = w.coop;
    const g = gate(w, { x: 0, y: 0, z: -18, w: 14, h: 5 });
    plate(w, { x: -3, y: 0, z: -12, need: 'both', label: 'BOTH STAND HERE' }, (on) => g.set(on));
    deck(w, { x: 0, y: 0, z: -34, w: 16, d: 24, path: true });
    w.goal({ x: 0, y: 0, z: -40 });
    sign(w, 'ICEBREAKERS', 0, 4, -8);
    lake(w);
  },
};
