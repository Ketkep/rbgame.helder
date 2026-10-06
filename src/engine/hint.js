import * as THREE from 'three';
import { softTexture } from './materials.js';

/**
 * The hint trail: a dotted line with pulses flowing toward where you should go, drawn as glowing dots
 * (with a small arc between platforms so you can see where to jump). Points are world-space {x,y,z}.
 */
export class HintTrail {
  constructor(world) {
    this.w = world;
    this.active = false;
    this.t = 0; this.dur = 0;
    this.pts = null; this.base = null; this.orbs = [];
  }

  show(points, seconds) {
    this.hide();
    if (!points || points.length < 2) return;
    const SP = 0.5;
    const pos = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dist = Math.hypot(b.x - a.x, b.z - a.z), dy = b.y - a.y;
      const arc = Math.min(2.4, 0.16 * dist + Math.max(0, dy) * 0.6 + 0.15);
      const n = Math.max(2, Math.ceil(Math.hypot(dist, dy) / SP));
      for (let k = (i === 0 ? 0 : 1); k <= n; k++) {
        const u = k / n;
        pos.push(a.x + (b.x - a.x) * u, a.y + dy * u + arc * 4 * u * (1 - u), a.z + (b.z - a.z) * u);
      }
    }
    const count = pos.length / 3;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({
      map: softTexture('glow'), size: 0.34, vertexColors: true, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.pts.frustumCulled = false; this.pts.renderOrder = 999;
    this.w.scene.add(this.pts);
    this.count = count;
    // a glowing orb at each waypoint you are heading for
    for (let i = 1; i < points.length; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('glow'), color: 0x66ffcc, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
      sp.position.set(points[i].x, points[i].y + 0.1, points[i].z); sp.renderOrder = 998; sp.scale.set(1.3, 1.3, 1);
      this.w.scene.add(sp); this.orbs.push(sp);
    }
    this.active = true; this.t = 0; this.dur = seconds;
    this.update(0);
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    if (this.t >= this.dur) { this.hide(); return; }
    const fade = Math.min(1, this.t / 0.3) * Math.min(1, (this.dur - this.t) / 1.0);
    const col = this.pts.geometry.attributes.color, arr = col.array;
    for (let i = 0; i < this.count; i++) {
      const pulse = 0.3 + 0.7 * Math.max(0, Math.sin(i * 0.55 - this.t * 7));
      const k = pulse * fade * 1.7;
      arr[i * 3] = 0.35 * k; arr[i * 3 + 1] = 1.0 * k; arr[i * 3 + 2] = 0.8 * k;
    }
    col.needsUpdate = true;
    this.orbs.forEach((o, i) => { const s = 1.1 + 0.35 * Math.sin(this.t * 5 + i); o.scale.set(s, s, 1); o.material.opacity = 0.75 * fade; });
  }

  hide() {
    this.active = false;
    if (this.pts) { this.w.scene.remove(this.pts); this.pts.geometry.dispose(); this.pts.material.dispose(); this.pts = null; }
    for (const o of this.orbs) { this.w.scene.remove(o); o.material.dispose(); }
    this.orbs = [];
  }
}
