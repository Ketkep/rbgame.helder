import { stalker } from './stalker.js';
import { scares } from './scare.js';
import { roles } from './roles.js';
import { horrorEnv, exitDoor, checkpoint, door, room, floor, box, decal, bed, locker, curtain, gurney, wheelchair, pipes, desk, barWindow as wardWindow, stencil } from './kit.js';

// Chapter 1 — Intake. (Vertical slice: the look first. Puzzles and the stalker come next.)
export default {
  id: 'lowtide1',
  name: 'Intake',
  music: 'l1',
  horror: true,
  deathRule: 'self',
  completeQuip: 'Intake complete. Please do not remove your wristband.',
  titleCam: { center: [0, 2, -20], radius: 18, height: 8 },

  build(w, game) {
    const H = horrorEnv(w, game);
    const c = w.coop, me = c.me;
    w.spawn = { x: me === 'p1' ? -2.2 : 2.2, y: 0, z: 2.5, yaw: 0 };
    w.respawn = { ...w.spawn };
    const tell = (r, k, o) => c.tell(r, k, o);

    // ---- the ward: six beds, two of them yours --------------------------------------------------------------------------
    room(w, { x: 0, z: -1, w: 14, d: 14, doors: { n: [{ c: 0, w: 1.8 }] } });
    for (let i = 0; i < 3; i++) { bed(w, { x: -5.4, z: -5 + i * 3.6, rot: Math.PI / 2, strapped: i === 0 }); bed(w, { x: 5.4, z: -5 + i * 3.6, rot: -Math.PI / 2, strapped: i === 1 }); }
    curtain(w, { x: -4.2, z: -3.2, width: 3.0, rot: Math.PI / 2 }); curtain(w, { x: 4.2, z: 0.4, width: 3.0, rot: Math.PI / 2, open: 0.5 });
    wardWindow(w, { x: -6.82, y: 1.9, z: -1, rot: Math.PI / 2 }); wardWindow(w, { x: 6.82, y: 1.9, z: 2.4, rot: -Math.PI / 2 });
    H.lamp({ x: -2, y: 3.35, z: -2, mode: 'buzz', rot: 0 }); H.lamp({ x: 2, y: 3.35, z: 3, mode: 'dying' });
    decal(w, { kind: 'drag', seed: 3, x: 0, y: 0.02, z: -6, w: 3, h: 3, face: 'floor', rot: 1.4 });
    decal(w, { kind: 'puddle', seed: 2, x: 1, y: 0.025, z: 1, w: 2.4, h: 2.4 });
    decal(w, { kind: 'hand', seed: 5, x: -6.8, y: 1.3, z: -4.5, w: 0.5, h: 0.5, face: 'e' });
    stencil(w, 'WARD B · NIGHT', { x: 0, y: 2.7, z: 5.82, rot: Math.PI, width: 3.4 });
    wheelchair(w, { x: 2.5, z: -5.2, rot: 2.4 });

    // ---- the corridor north ---------------------------------------------------------------------------------------------
    room(w, { x: 0, z: -29, w: 4.6, d: 44, h: 3.4, doors: { e: [{ c: 12, w: 1.6 }, { c: -2, w: 1.6 }], w: [{ c: 6, w: 1.6 }, { c: -14, w: 1.6 }], s: [{ c: 0, w: 1.8 }] }, sides: { s: false, n: false } });
    for (let i = 0; i < 7; i++) H.lamp({ x: 0, y: 3.35, z: -10 - i * 6.2, mode: ['buzz', 'steady', 'dying', 'buzz', 'dead', 'buzz', 'steady'][i], rot: Math.PI / 2, len: 1.4 });
    pipes(w, { x0: -1.9, z0: -8, x1: -1.9, z1: -50, y: 2.9, n: 2 });
    decal(w, { kind: 'splat', seed: 7, x: 1.3, y: 0.02, z: -22, w: 2.4, h: 2.4 });
    decal(w, { kind: 'drag', seed: 9, x: 0, y: 0.02, z: -34, w: 3.4, h: 2.4, rot: 1.57 });
    decal(w, { kind: 'scratch', seed: 4, x: -2.3, y: 1.4, z: -27, w: 1.4, h: 1.4, face: 'e' });
    decal(w, { kind: 'hand', seed: 8, x: 2.3, y: 1.1, z: -18, w: 0.5, h: 0.5, face: 'w' });
    gurney(w, { x: 1.1, z: -16.5, rot: 0.2, solid: true });
    stencil(w, 'WARD B', { x: -2.3, y: 2.6, z: -9, rot: Math.PI / 2, width: 2.4 });

    // ---- side rooms: records office (east) and a locker room (west) -----------------------------------------------------
    room(w, { x: 6.2, z: -17, w: 8, d: 6, sides: { w: false }, doors: {}, path: false });
    desk(w, { x: 7.6, z: -18.4, rot: Math.PI / 2 }); box(w, { x: 9.7, y: 1.1, z: -16, w: 0.5, h: 2.2, d: 2.4, kind: 'rust', color: 0x66726c, rough: 0.6 });
    H.lamp({ x: 6.2, y: 3.35, z: -17, mode: 'dying' });
    room(w, { x: -6.2, z: -23, w: 8, d: 6, sides: { e: false }, doors: {}, path: false });
    for (let i = 0; i < 5; i++) locker(w, { x: -9.4, z: -25 + i * 0.64, rot: Math.PI / 2, ajar: i === 3 ? 0.7 : 0 });
    H.lamp({ x: -6.2, y: 3.35, z: -23, mode: 'buzz' });

    // ---- the end of the corridor: a big door, a hall behind it -----------------------------------------------------------
    room(w, { x: 0, z: -58, w: 16, d: 16, doors: { s: [{ c: 0, w: 4.4 }] }, floorKind: 'tile', wallKind: 'tile' });
    H.lamp({ x: 0, y: 3.35, z: -58, mode: 'strobe', len: 2.2 }); H.lamp({ x: -5, y: 3.35, z: -54, mode: 'dead' }); H.lamp({ x: 5, y: 3.35, z: -62, mode: 'dying' });
    for (let i = 0; i < 4; i++) bed(w, { x: -5.5 + i * 3.7, z: -63, rot: 0, strapped: i % 2 === 0 });
    exitDoor(w, { x: 0, z: -65.7, rot: 0 });

    checkpoint(w, { x: 0, z: -10 }); checkpoint(w, { x: 0, z: -40 });
    door(w, { x: 0, z: -8, along: 'x', width: 1.8, key: 'ward', label: 'ward door' });
    const st = stalker(w, game, H, H.S, { nodes: [{ id: 'a', x: 0, z: -12 }, { id: 'b', x: 0, z: -26 }, { id: 'c', x: 0, z: -40 }, { id: 'd', x: 0, z: -52 }, { id: 'e', x: 6, z: -17 }, { id: 'f', x: -6, z: -23 }], route: ['a', 'e', 'b', 'f', 'c', 'd', 'c', 'b'], start: 'c' });
    st.hideSpot({ x: -9.2, z: -23, w: 1.6, d: 4 }); st.hideSpot({ x: 8.6, z: -15, w: 2.4, d: 2.4 });
    const Z = scares(w, game, H, H.S), R = roles(w, game);
    c.zone({ x: 0, y: 1, z: -30, w: 4.6, h: 3, d: 2, need: 'any' }).onChange((zn) => { if (zn.active && !Z._once1) { Z._once1 = true; Z.fire('behind', { kind: 'patient', role: 'p1' }); } });
    c.zone({ x: 0, y: 1, z: -46, w: 4.6, h: 3, d: 2, need: 'any' }).onChange((zn) => { if (zn.active && !Z._once2) { Z._once2 = true; Z.fire('rush', { kind: 'orderly', role: R.keyholder }); } });
    c.tell(me, 'Patient. Please remain calm. This is the Night Desk.', { priority: 2 });
    void floor; void tell;
  },
};
