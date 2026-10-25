import * as THREE from 'three';

// Procedural humanoids for Lowtide: "the Orderly" (tall, stained whites, a blank mask), a pale patient, and the doll-like wrong-partner.
// Built from capsules/cylinders so they read as silhouettes in torchlight; pose() animates a gait from a phase.

const skin = () => new THREE.MeshStandardMaterial({ color: 0x8d877a, roughness: 0.85, metalness: 0 });
const coat = (c = 0xa7a89a) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0 });
const dark = () => new THREE.MeshStandardMaterial({ color: 0x0a0b0c, roughness: 0.9 });
const stain = () => new THREE.MeshStandardMaterial({ color: 0x4a0c10, roughness: 0.8 });

export function figure(w, { kind = 'orderly', scale = 1 } = {}) {
  const g = new THREE.Group(); const root = new THREE.Group(); g.add(root); g.scale.setScalar(scale);
  const tall = kind === 'orderly' ? 1.18 : 1.0;
  const cloth = kind === 'orderly' ? coat(0x5f6259) : kind === 'patient' ? coat(0x6a7670) : coat(0x6b7773);
  const add = (parent, geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  const hips = new THREE.Group(); hips.position.y = 0.95 * tall; root.add(hips);
  const torso = new THREE.Group(); torso.position.y = 0.05; hips.add(torso);
  add(torso, new THREE.CapsuleGeometry(0.2, 0.55 * tall, 6, 12), cloth, 0, 0.42 * tall, 0, 1.1, 1, 0.75);
  add(torso, new THREE.CylinderGeometry(0.23, 0.3, 0.7, 12, 1, true), cloth, 0, 0.0, 0, 1, 1, 0.8).material.side = THREE.DoubleSide;     // the gown / coat skirt
  if (kind === 'orderly') { add(torso, new THREE.BoxGeometry(0.28, 0.22, 0.05), stain(), 0.05, 0.4, 0.17); add(torso, new THREE.BoxGeometry(0.5, 0.06, 0.34), dark(), 0, 0.12, 0); }
  const neck = new THREE.Group(); neck.position.set(0, 0.85 * tall, 0.02); torso.add(neck);
  const head = new THREE.Group(); head.position.y = 0.16; neck.add(head);
  add(head, new THREE.SphereGeometry(0.16, 16, 14), skin(), 0, 0.06, 0.01, 0.9, 1.15, 0.95);
  if (kind === 'orderly') {                                                                                     // a blank mask, a stitched mouth, two dark holes, two faint pinpricks
    add(head, new THREE.SphereGeometry(0.168, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: 0xd8d6cc, roughness: 0.55 }), 0, 0.07, 0.015, 0.92, 1.17, 0.97).rotation.x = -0.35;
    for (const sx of [-0.06, 0.06]) { add(head, new THREE.SphereGeometry(0.035, 8, 8), dark(), sx, 0.1, 0.15, 1, 1.3, 0.6); add(head, new THREE.SphereGeometry(0.008, 6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3a2a).multiplyScalar(2.5), toneMapped: false }), sx, 0.1, 0.178); }
    add(head, new THREE.BoxGeometry(0.1, 0.008, 0.01), dark(), 0, -0.02, 0.165);
  } else {
    for (const sx of [-0.06, 0.06]) add(head, new THREE.SphereGeometry(0.03, 8, 8), dark(), sx, 0.1, 0.15, 1, 1.4, 0.6);
    add(head, new THREE.BoxGeometry(0.08, 0.012, 0.01), stain(), 0, -0.02, 0.16);
  }
  const arms = [];
  for (const side of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(side * 0.27, 0.78 * tall, 0); torso.add(sh);
    add(sh, new THREE.CylinderGeometry(0.045, 0.04, 0.5 * tall, 8), cloth, 0, -0.25 * tall, 0);
    const el = new THREE.Group(); el.position.y = -0.5 * tall; sh.add(el);
    add(el, new THREE.CylinderGeometry(0.04, 0.032, 0.55 * tall, 8), skin(), 0, -0.27 * tall, 0);
    add(el, new THREE.SphereGeometry(0.05, 8, 8), skin(), 0, -0.56 * tall, 0, 1, 1.4, 0.6);
    arms.push({ sh, el, side });
  }
  const legs = [];
  for (const side of [-1, 1]) {
    const hp = new THREE.Group(); hp.position.set(side * 0.1, 0, 0); hips.add(hp);
    add(hp, new THREE.CylinderGeometry(0.075, 0.06, 0.5 * tall, 8), cloth, 0, -0.25 * tall, 0);
    const kn = new THREE.Group(); kn.position.y = -0.5 * tall; hp.add(kn);
    add(kn, new THREE.CylinderGeometry(0.055, 0.045, 0.46 * tall, 8), cloth, 0, -0.23 * tall, 0);
    add(kn, new THREE.BoxGeometry(0.1, 0.06, 0.24), dark(), 0, -0.48 * tall, 0.05);
    legs.push({ hp, kn, side });
  }
  w.add(g);
  const F = { group: g, head, neck, state: 'walk', lean: 0, twitch: 0 };
  /** phase: gait phase (radians); speed 0..1 (1 = running); lean: forward hunch 0..1; twitch: head jerks (seconds-based noise). */
  F.pose = (phase, speed = 0.4, lean = 0, t = 0) => {
    const a = Math.sin(phase) * (0.35 + speed * 0.5);
    legs[0].hp.rotation.x = a; legs[1].hp.rotation.x = -a; legs[0].kn.rotation.x = Math.max(0, -a) * 1.1; legs[1].kn.rotation.x = Math.max(0, a) * 1.1;
    arms[0].sh.rotation.x = -a * 0.7 - 0.1; arms[1].sh.rotation.x = a * 0.7 - 0.1; arms[0].el.rotation.x = -0.25 - speed * 0.4; arms[1].el.rotation.x = -0.25 - speed * 0.4;
    arms[0].sh.rotation.z = 0.05; arms[1].sh.rotation.z = -0.05;
    hips.position.y = (0.95 * tall) + Math.abs(Math.sin(phase)) * 0.04 * (0.4 + speed);
    torso.rotation.x = 0.12 + lean * 0.45 + (kind === 'orderly' ? 0.1 : 0); torso.rotation.z = Math.sin(phase * 0.5) * 0.05;
    const j = Math.sin(t * 7.3) * Math.sin(t * 2.1);
    head.rotation.z = 0.25 + j * 0.12 * (1 + F.twitch * 2) ; head.rotation.x = -0.1 - lean * 0.4 + Math.sin(t * 3.1) * 0.05; head.rotation.y = Math.sin(t * 0.7) * 0.25 * (1 - lean);
  };
  F.face = (yaw) => { g.rotation.y = yaw; };
  F.set = (x, y, z) => g.position.set(x, y, z);
  return F;
}
