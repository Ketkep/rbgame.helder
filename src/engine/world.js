import * as THREE from 'three';
import { Body, playerTouches, groundBelow } from './physics.js';
import { surfaceMaterial, plainMaterial, glowMaterial, boxGeometry, edgeGeometry, textTexture, softTexture, disposeGeometryCaches } from './materials.js';

const V3 = THREE.Vector3;

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // always at the far plane
}`;
const SKY_FRAG = /* glsl */`
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; uniform vec3 uSunDir; uniform vec3 uSunColor;
uniform float uStars; uniform float uTime;
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.5)) : mix(uHorizon, uBottom, pow(clamp(-h, 0.0, 1.0), 0.45));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(sd, 700.0) * 4.0 + pow(sd, 18.0) * 0.45 + pow(sd, 3.0) * 0.06);
  if (uStars > 0.0) {
    vec3 cell = floor(d * 420.0);
    float r = hash(cell);
    float s = step(0.9965, r) * smoothstep(0.0, 0.25, h);
    col += vec3(s) * uStars * (0.55 + 0.45 * sin(uTime * 2.0 + r * 60.0));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/** A platform you can stand on. */
export class Plat {
  constructor(world, body, group, o) {
    this.world = world; this.body = body; this.group = group; this.o = o;
    this.base = new V3(body.x, body.y, body.z);
    this.h = o.h;
  }
  get top() { return this.body.top; }
  setPos(x, y, z) { // x,y,z = new *centre*
    this.body.setCenter(x, y, z);
    this.group.position.set(x, y, z);
  }
  setEnabled(on) { this.body.enabled = on; this.group.visible = on; }
  /** Re-parent a scenery mesh (made with world.box etc.) so it travels with this platform. */
  attach(mesh) {
    this.world.scene.remove(mesh);
    mesh.position.sub(this.group.position);
    mesh.matrixAutoUpdate = true;
    this.group.matrixAutoUpdate = true;
    this.group.add(mesh);
    return mesh;
  }
}

export class World {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.bodies = [];
    this.plats = [];
    this.movers = [];
    this.hazards = [];
    this.triggers = [];
    this.winds = [];
    this.timers = [];
    this.updaters = [];
    this.respawnHooks = [];
    this.disposers = [];
    this.ownTextures = [];
    this.t = 0;
    this.spawn = { x: 0, y: 0, z: 0, yaw: 0 };
    this.respawn = { x: 0, y: 0, z: 0, yaw: 0 };
    this.killY = -60;
    this.theme = { tex: 'tile', color: 0xffffff, trim: null, edge: 0x6b6f8a, edgeOpacity: 0.3, roughness: 0.6, accent: 0x2dd4bf, danger: 0xff4d5e };
    this.envCfg = null;
    this.extraAccel = { x: 0, z: 0 };
    this.checkpoints = [];
    this.interactables = [];  // things you can press E on
    this.stepHeight = 0;      // >0 enables auto step-up (stairs) for this world
    this.isHub = false;
    this._bursts = [];
    this.completed = false;
    this.hooks = {};          // onDeath, onCheckpoint, onLand, onComplete, onCreditsEnd, frame
    this.windLevel = 0;       // ambient wind loudness 0..1 (set by levels)
    this.windAmt = 0;         // 1 while the player is inside a gust
    this.altimeter = null;    // { max, record } to show the height meter
  }

  // =========================================================================================
  //  Environment
  // =========================================================================================
  env(cfg) {
    const c = (this.envCfg = {
      top: 0x7aa7ff, horizon: 0xdfe9ff, bottom: 0x9aa4c8,
      fog: { near: 40, far: 260 },
      sun: { color: 0xfff1d6, intensity: 2.4, dir: [0.5, 0.9, 0.35] },
      hemi: { sky: 0xbcd0ff, ground: 0x8a8fb0, intensity: 0.9 },
      exposure: 1.0,
      bloom: { strength: 0.35, radius: 0.6, threshold: 0.9 },
      stars: 0,
      clouds: null,
      motes: { color: 0xffffff, count: 220, size: 0.09, opacity: 0.5 },
      ...cfg,
    });
    const scene = this.scene;
    scene.fog = new THREE.Fog(c.fog.color ?? c.horizon, c.fog.near, c.fog.far);
    scene.background = new THREE.Color(c.horizon);

    // sky dome
    this.skyUniforms = {
      uTop: { value: new THREE.Color(c.top) }, uHorizon: { value: new THREE.Color(c.horizon) }, uBottom: { value: new THREE.Color(c.bottom) },
      uSunDir: { value: new V3(...c.sun.dir).normalize() }, uSunColor: { value: new THREE.Color(c.sun.color) },
      uStars: { value: c.stars }, uTime: { value: 0 },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(500, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    sky.frustumCulled = false; sky.renderOrder = -10;
    this.sky = sky; scene.add(sky);

    // lights
    this.hemi = new THREE.HemisphereLight(c.hemi.sky, c.hemi.ground, c.hemi.intensity);
    scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(c.sun.color, c.sun.intensity));
    sun.castShadow = c.sun.shadow !== false;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46; sc.near = 1; sc.far = 260;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
    this.sunDir = new V3(...c.sun.dir).normalize();
    scene.add(sun, sun.target);

    if (c.envMap) this._buildEnvMap(c.envMap);

    // soft clouds
    if (c.clouds) this._makeClouds(c.clouds);
    // dust motes that give the camera something to read speed against
    this._makeMotes(c.motes);

    // blob shadow under the player (huge help for judging jumps)
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: softTexture('shadow'), transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    sh.rotation.x = -Math.PI / 2; sh.renderOrder = 5; sh.visible = false;
    this.blob = sh; scene.add(sh);
  }

  /** Image-based lighting from a tiny procedural scene: gradient room + bright light panels. Makes marble/brass shine. */
  _buildEnvMap(cfg) {
    const pm = new THREE.PMREMGenerator(this.game.renderer);
    const sc = new THREE.Scene();
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(cfg.top ?? 0xffe6c0) }, mid: { value: new THREE.Color(cfg.mid ?? 0x6a4a3a) }, bottom: { value: new THREE.Color(cfg.bottom ?? 0x1a1210) } },
      vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 d; void main(){ float h = d.y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.6)) : mix(mid, bottom, pow(-h, 0.5)); gl_FragColor = vec4(c, 1.0); }',
    });
    sc.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat));
    for (const L of cfg.lights || []) {
      const q = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), new THREE.MeshBasicMaterial({ color: new THREE.Color(L.color).multiplyScalar(L.intensity ?? 6), side: THREE.DoubleSide }));
      q.position.set(...L.pos); q.lookAt(0, 0, 0); sc.add(q);
    }
    this._envRT = pm.fromScene(sc, 0.025);
    this.scene.environment = this._envRT.texture;
    this.scene.environmentIntensity = cfg.intensity ?? 0.7;
    pm.dispose();
  }

  _makeClouds(cfg) {
    const { count = 40, color = 0xffffff, y = [-30, 60], radius = [120, 420], opacity = 0.5, size = [40, 110] } = cfg;
    const mat = new THREE.SpriteMaterial({ map: softTexture('puff'), color, transparent: true, opacity, depthWrite: false });
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = radius[0] + Math.random() * (radius[1] - radius[0]);
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = y[0] + Math.random() * (y[1] - y[0]);
      const s = size[0] + Math.random() * (size[1] - size[0]);
      for (let j = 0; j < 5; j++) {
        const sp = new THREE.Sprite(mat);
        sp.position.set(cx + (Math.random() - 0.5) * s * 0.9, cy + (Math.random() - 0.5) * s * 0.18, cz + (Math.random() - 0.5) * s * 0.9);
        const k = s * (0.5 + Math.random() * 0.6);
        sp.scale.set(k, k * 0.45, 1);
        this.scene.add(sp);
      }
    }
  }

  _makeMotes(cfg) {
    const n = cfg.count;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    this._moteSeed = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) this._moteSeed[i] = Math.random();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({ map: softTexture('glow'), color: cfg.color, size: cfg.size * 5, transparent: true, opacity: cfg.opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }

  setTheme(t) { Object.assign(this.theme, t); }

  // =========================================================================================
  //  Geometry
  // =========================================================================================
  /**
   * Platform. `y` is the TOP surface height; x/z are the centre. Everything is axis-aligned.
   * style: 'floor' | 'accent' | 'danger' | 'ghost' | 'metal' | custom {tex,color,trim}
   */
  plat(o) {
    const { x = 0, y = 0, z = 0, w = 4, d = 4, h = 1, style = 'floor', collide = true } = o;
    const th = this.theme;
    let tex = th.tex, color = th.color, trim = th.trim, edge = th.edge;
    if (style === 'accent') { color = th.accent; trim = th.accent; }
    else if (style === 'danger') { color = th.danger; trim = th.danger; }
    else if (style === 'dark') { tex = o.tex || 'metal'; color = 0x555a66; }
    if (o.tex) tex = o.tex;
    if (o.edge !== undefined) edge = o.edge;
    if (o.color !== undefined) color = o.color;
    if (o.trim !== undefined) trim = o.trim;
    const mat = surfaceMaterial({ tex, color, roughness: o.roughness ?? th.roughness, metalness: o.metalness ?? th.metalness ?? 0.05 });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(boxGeometry(w, h, d, o.radius ?? Math.min(0.09, h / 3)), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    if (trim !== null && trim !== undefined) {
      const tr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.07, d + 0.03), glowMaterial(trim, 1.5));
      tr.position.y = h / 2 - 0.1;
      group.add(tr);
    }
    if (th.edgeOpacity > 0 && edge !== null) {
      const ln = new THREE.LineSegments(edgeGeometry(w, h, d), this._lineMat(edge, th.edgeOpacity));
      group.add(ln);
    }
    if (o.rock) {
      const big = Math.max(w, d), rh = Math.min(11, big * 0.95);
      this._rockMat = this._rockMat || new THREE.MeshStandardMaterial({ color: th.rock ?? 0x7a6470, emissive: th.rockGlow ?? 0x2b1d26, roughness: 0.95, flatShading: true });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(big * 0.62, rh, 6), this._rockMat);
      cone.rotation.x = Math.PI; cone.rotation.y = (x * 7.3 + z * 3.1) % 6.28;
      cone.scale.set(w / big, 1, d / big);
      cone.position.y = -h / 2 - rh / 2 + 0.05; cone.castShadow = true;
      group.add(cone);
    }
    if (o.slippery) {
      // faint wet sheen on the top face; the body gets low-friction ground control (see physics.js)
      this._wetMat = this._wetMat || new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6aa8ff).multiplyScalar(0.7), transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, d - 0.06), this._wetMat);
      sh.rotation.x = -Math.PI / 2; sh.position.y = h / 2 + 0.004;
      group.add(sh);
    }
    group.position.set(x, y - h / 2, z);
    const body = new Body(x, y - h / 2, z, w / 2, h / 2, d / 2);
    body.enabled = collide;
    body.tag = o.tag || null;
    if (o.slippery) body.slip = o.slippery === true ? 0.88 : o.slippery;
    const plat = new Plat(this, body, group, { ...o, h });
    if (!o.moving) { group.matrixAutoUpdate = false; group.updateMatrix(); }
    this.scene.add(group);
    this.bodies.push(body);
    this.plats.push(plat);
    return plat;
  }

  _lineMat(color, opacity) {
    this._lineCache = this._lineCache || new Map();
    const k = color + '|' + opacity;
    if (!this._lineCache.has(k)) this._lineCache.set(k, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    return this._lineCache.get(k);
  }

  /** Non-colliding scenery box. */
  box(o) {
    const { x = 0, y = 0, z = 0, w = 1, h = 1, d = 1, color = 0xffffff, tex = null, emissive = null, glow = null, shadow = true, rot = 0, rough = 0.6 } = o;
    let mat;
    if (glow !== null) mat = glowMaterial(glow, o.glowIntensity ?? 1.5);
    else if (tex) mat = surfaceMaterial({ tex, color, roughness: rough });
    else mat = plainMaterial(color, { emissive: emissive ?? 0, emissiveIntensity: emissive ? 1 : 0, roughness: rough, metalness: o.metal ?? 0 });
    const m = new THREE.Mesh(boxGeometry(w, h, d, o.radius ?? 0.05), mat);
    m.position.set(x, y, z); m.rotation.y = rot;
    m.castShadow = shadow; m.receiveShadow = true;
    if (o.static !== false) { m.matrixAutoUpdate = false; m.updateMatrix(); }
    this.scene.add(m);
    return m;
  }

  /** Add any THREE object as scenery. */
  add(obj) { this.scene.add(obj); return obj; }

  sign(o) {
    const { text, x = 0, y = 0, z = 0, w = 4, h = 1, rotY = 0, rotX = 0, tw = 512, th = 128, glow = false, double = true, opacity = 1 } = o;
    const tex = textTexture(text, { w: tw, h: Math.round(tw * h / w) || th, color: o.color || '#ffffff', bg: o.bg ?? null, border: o.border ?? null, stroke: o.stroke ?? null, glow: o.glowColor ?? null, font: o.font, size: o.size || 0, align: o.align || 'center' });
    this.ownTextures.push(tex);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, side: double ? THREE.DoubleSide : THREE.FrontSide, toneMapped: false, depthWrite: !o.bg ? false : true });
    if (glow) mat.color.setScalar(glow === true ? 1.8 : glow);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.set(rotX, rotY, 0, 'YXZ');
    this.scene.add(m);
    return m;
  }

  /** A real point light. Use sparingly. */
  light(color, intensity, distance, x, y, z) {
    const l = new THREE.PointLight(color, intensity, distance, 1.6);
    l.position.set(x, y, z);
    this.scene.add(l);
    return l;
  }

  /** Invisible solid box (for things whose visuals are not boxes: columns, furniture…). Centre-based. */
  collider({ x, y, z, w = 1, h = 1, d = 1 }) {
    const b = new Body(x, y, z, w / 2, h / 2, d / 2);
    this.bodies.push(b);
    return b;
  }

  /**
   * Something the player can press E (or click) on while looking at it within `range` metres.
   * `label` may be a string or a function returning one; `enabled` (optional) hides it when false.
   */
  interactable({ x, y, z, w = 0.6, h = 0.6, d = 0.6, label = 'Use', onUse, range = 3.2, enabled = null, pad = 0.12 }) {
    const body = new Body(x, y, z, w / 2, h / 2, d / 2);
    body.solid = false;
    const it = { body, label, onUse, range, enabled, pad };
    this.interactables.push(it);
    return it;
  }

  /** A real spotlight, optionally shadow-casting (use one or two per scene). */
  spotLight({ color = 0xfff0d0, intensity = 40, x, y, z, tx, ty, tz, angle = 1.2, penumbra = 0.6, distance = 0, shadow = false, mapSize = 2048, far = 60 }) {
    const l = new THREE.SpotLight(color, intensity, distance, angle, penumbra, 1.2);
    l.position.set(x, y, z); l.target.position.set(tx, ty, tz);
    if (shadow) {
      l.castShadow = true; l.shadow.mapSize.set(mapSize, mapSize);
      l.shadow.camera.near = 0.5; l.shadow.camera.far = far; l.shadow.bias = -0.0003; l.shadow.normalBias = 0.04;
    }
    this.scene.add(l, l.target);
    return l;
  }

  // =========================================================================================
  //  Behaviours
  // =========================================================================================
  /** Make a platform move. `fn(t)` returns an offset {x,y,z} from where it was placed. */
  mover(plat, fn) {
    plat.o.moving = true;
    plat.group.matrixAutoUpdate = true;
    this.movers.push({ plat, fn });
    return plat;
  }

  /** Falls away shortly after the player steps on it. */
  crumble(plat, { delay = 0.5, gone = 3.5 } = {}) {
    plat.o.moving = true; plat.group.matrixAutoUpdate = true;
    const s = { plat, state: 'idle', t: 0, delay, gone, vy: 0 };
    this.updaters.push((dt) => this._crumbleStep(s, dt));
    this.respawnHooks.push(() => this._crumbleReset(s));
    return plat;
  }
  _crumbleReset(s) {
    s.state = 'idle'; s.t = 0; s.vy = 0;
    s.plat.setPos(s.plat.base.x, s.plat.base.y, s.plat.base.z);
    s.plat.setEnabled(true);
    s.plat.group.scale.setScalar(1);
  }
  _crumbleStep(s, dt) {
    const p = s.plat, pl = this.game.player;
    if (s.state === 'idle') {
      if (pl.grounded && pl.ground === p.body) { s.state = 'shake'; s.t = 0; this.game.audio.crumble(); }
    } else if (s.state === 'shake') {
      s.t += dt;
      p.group.position.set(p.base.x + (Math.random() - 0.5) * 0.07, p.base.y + (Math.random() - 0.5) * 0.03, p.base.z + (Math.random() - 0.5) * 0.07);
      if (s.t >= s.delay) { s.state = 'fall'; s.t = 0; s.vy = 0; p.body.enabled = false; }
    } else if (s.state === 'fall') {
      s.t += dt; s.vy -= 30 * dt;
      p.group.position.y += s.vy * dt;
      p.group.scale.setScalar(Math.max(0.01, 1 - s.t * 0.7));
      if (s.t > 1.4) { s.state = 'gone'; s.t = 0; p.group.visible = false; }
    } else if (s.state === 'gone') {
      s.t += dt;
      if (s.t >= s.gone) { this._crumbleReset(s); }
    }
  }

  /**
   * Starts rolling away shortly after the player steps on it, then (slowly) rolls back.
   * dir: [x,z] unit-ish vector. Attach wheels/poles to plat.group so they travel with it.
   */
  rollaway(plat, { dir = [1, 0], dist = 5, accel = 4, speed = 5, delay = 0.6, hold = 2.2, back = 1.6, onGo = null } = {}) {
    plat.o.moving = true; plat.group.matrixAutoUpdate = true;
    const len = Math.hypot(dir[0], dir[1]) || 1, ux = dir[0] / len, uz = dir[1] / len;
    const s = { plat, state: 'idle', t: 0, s: 0, v: 0 };
    const place = () => plat.setPos(plat.base.x + ux * s.s, plat.base.y, plat.base.z + uz * s.s);
    const reset = () => { s.state = 'idle'; s.t = 0; s.s = 0; s.v = 0; plat.setPos(plat.base.x, plat.base.y, plat.base.z); };
    this.updaters.push((dt) => {
      const pl = this.game.player;
      if (s.state === 'idle') {
        if (pl.grounded && pl.ground === plat.body) { s.state = 'wait'; s.t = 0; this.game.audio.crumble(); }
      } else if (s.state === 'wait') {
        s.t += dt;
        plat.group.position.x = plat.base.x + (Math.random() - 0.5) * 0.03;
        if (s.t >= delay) { s.state = 'go'; s.v = 0; if (onGo) onGo(); }
      } else if (s.state === 'go') {
        s.v = Math.min(speed, s.v + accel * dt); s.s += s.v * dt;
        if (s.s >= dist) { s.s = dist; s.state = 'hold'; s.t = 0; s.v = 0; }
        place();
      } else if (s.state === 'hold') {
        s.t += dt; place();
        if (s.t >= hold) { s.state = 'back'; }
      } else if (s.state === 'back') {
        s.s -= back * dt;
        if (s.s <= 0) { s.s = 0; s.state = 'idle'; }
        place();
      }
    });
    this.respawnHooks.push(reset);
    return plat;
  }

  /** Conveyor belt: whatever stands on it is carried at (vx, vz) m/s. Belts must run along X or Z. */
  conveyor(plat, { vx = 0, vz = 0, color = 0x2a2d3a } = {}) {
    plat.body.conv = [vx, vz];
    const sp = Math.hypot(vx, vz) || 1, alongX = Math.abs(vx) > Math.abs(vz);
    const across = alongX ? plat.o.d : plat.o.w, along = alongX ? plat.o.w : plat.o.d;
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#' + new THREE.Color(color).getHexString(); g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#d8a94a'; g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(26, 78); g.lineTo(64, 36); g.lineTo(102, 78); g.stroke();   // chevron pointing up (+v)
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
    tex.repeat.set(Math.max(1, Math.round(across / 2)), Math.max(1, Math.round(along / 2)));
    this.ownTextures.push(tex);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(across - 0.2, along - 0.1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    mesh.rotation.set(-Math.PI / 2, Math.atan2(-vx, -vz), 0, 'YXZ');
    mesh.position.y = plat.o.h / 2 + 0.006; mesh.receiveShadow = true;
    plat.group.add(mesh);
    const cycle = along / tex.repeat.y;
    this.updaters.push((dt) => { tex.offset.y -= (sp * dt) / cycle; });
    return plat;
  }

  /** Kill volume. `move(t)` optionally returns an offset. */
  hazard(o) {
    const { x = 0, y = 0, z = 0, w = 1, h = 1, d = 1, color = 0xff2d4d, move = null } = o;
    const group = new THREE.Group();
    const core = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glowMaterial(color, 1.8, 0.85));
    group.add(core);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, h + 0.18, d + 0.18), glowMaterial(color, 0.9, 0.18));
    group.add(shell);
    group.position.set(x, y, z);
    this.scene.add(group);
    const body = new Body(x, y, z, w / 2, h / 2, d / 2);
    body.solid = false;
    const hz = { body, group, move, base: new V3(x, y, z), enabled: true, core, shell };
    this.hazards.push(hz);
    return hz;
  }

  /** Invisible volume. */
  trigger(o) {
    const { x = 0, y = 0, z = 0, w = 2, h = 2, d = 2, once = true, onEnter = null, onExit = null, onStay = null, resetOnRespawn = false } = o;
    const body = new Body(x, y, z, w / 2, h / 2, d / 2);
    body.solid = false;
    const t = { body, once, onEnter, onExit, onStay, inside: false, fired: false, resetOnRespawn, enabled: true };
    this.triggers.push(t);
    return t;
  }

  /** Wind gust volume pushing the player along (dx,dz). gust: {period, on} seconds. */
  wind(o) {
    const { x, y, z, w, h, d, dx = 0, dz = 1, strength = 18, period = 0, on = 0, phase = 0 } = o;
    const body = new Body(x, y, z, w / 2, h / 2, d / 2); body.solid = false;
    const wi = { body, dx, dz, strength, period, on, phase, active: true, streaks: null };
    // visual streaks
    const n = 26, pos = new Float32Array(n * 6), seeds = [];
    for (let i = 0; i < n; i++) seeds.push([Math.random(), Math.random(), Math.random()]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0 }));
    lines.frustumCulled = false;
    this.scene.add(lines);
    wi.streaks = { lines, seeds, n };
    this.winds.push(wi);
    return wi;
  }

  /** Run something after `sec` of world time. */
  after(sec, fn) { this.timers.push({ t: this.t + sec, fn }); }
  onUpdate(fn) { this.updaters.push(fn); }
  onRespawn(fn) { this.respawnHooks.push(fn); }
  /** Run when the level is unloaded (remove DOM overlays etc.). */
  onDispose(fn) { this.disposers.push(fn); }

  // ---- composite pieces ------------------------------------------------------------------
  checkpoint(o) {
    const { x, y, z, real = true, label = 'CHECKPOINT', yaw = 0, id = null } = o;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const col = real ? 0xffc83d : 0xe9b83f;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.12, 32), plainMaterial(0x222330, { roughness: 0.4, metalness: 0.6 }));
    base.position.y = 0.06; base.receiveShadow = true; base.castShadow = true; g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.045, 8, 48), glowMaterial(col, real ? 1.9 : 1.55));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.14; g.add(ring);
    const poleG = new THREE.Group(); g.add(poleG);
    // The fake ones are built very slightly off. Sharp eyes get rewarded.
    if (!real) poleG.rotation.z = 0.045;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.2, 12), plainMaterial(0xdddddd, { metalness: 0.7, roughness: 0.25 }));
    pole.position.set(-0.7, 1.7, 0); pole.castShadow = true; poleG.add(pole);
    const tex = textTexture(label, { w: 512, h: 160, bg: real ? '#ffc83d' : '#f0bd45', color: '#2a1c00', border: '#2a1c00', size: 60 });
    this.ownTextures.push(tex);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.62), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false }));
    flag.position.set(0.32, 2.85, 0); poleG.add(flag);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), glowMaterial(0xffffff, 2.2));
    orb.position.set(-0.7, 3.35, 0); poleG.add(orb);
    g.rotation.y = yaw;
    this.scene.add(g);
    const cp = { x, y, z, real, id, group: g, ring, flag, used: false, yaw };
    this.checkpoints.push(cp);
    this.trigger({
      x, y: y + 1.2, z, w: 2.4, h: 3.2, d: 2.4, once: false,
      onEnter: () => {
        if (cp.used) return;
        cp.used = true;
        this.burst(new V3(x, y + 0.4, z), 0xffc83d, 24);
        this.game.onCheckpoint(cp);
      },
    });
    this.updaters.push(() => { flag.position.y = 2.85 + Math.sin(this.t * 2.2 + x) * 0.03; });
    return cp;
  }

  goal(o) {
    const { x, y, z, yaw = 0, color = 0x2dd4bf, onReach = null } = o;
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = yaw;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 12, 56), glowMaterial(color, 2.2));
    ring.position.y = 1.9; g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.04, 8, 56), glowMaterial(0xffffff, 1.5, 0.6));
    ring2.position.y = 1.9; g.add(ring2);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), new THREE.MeshBasicMaterial({ map: softTexture('glow'), color: new THREE.Color(color).multiplyScalar(1.0), transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    disc.position.y = 1.9; g.add(disc);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 40, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.0), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 20; g.add(beam);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.18, 36), plainMaterial(0x1c1d28, { metalness: 0.5, roughness: 0.35 }));
    base.position.y = 0.09; base.receiveShadow = true; g.add(base);
    this.scene.add(g);
    const obj = { group: g, x, y, z, ring, ring2, disc, trig: null };
    obj.trig = this.trigger({
      x, y: y + 1.9, z, w: 2.6, h: 3.4, d: 2.6, once: true,
      onEnter: () => { if (this.completed) return; (onReach || (() => this.game.completeLevel()))(); },
    });
    obj.setPos = (nx, ny, nz) => { obj.x = nx; obj.y = ny; obj.z = nz; g.position.set(nx, ny, nz); obj.trig.body.setCenter(nx, ny + 1.9, nz); };
    this.updaters.push((dt) => { ring.rotation.z += dt * 0.8; ring2.rotation.z -= dt * 0.5; disc.material.opacity = 0.55 + Math.sin(this.t * 3) * 0.1; });
    this.goalObj = obj;
    return obj;
  }

  /** Little confetti / spark burst. */
  burst(pos, color = 0xffffff, n = 30, speed = 5) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) {
      p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.1, s = speed * (0.4 + Math.random());
      v.push(Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s * 1.2, Math.sin(a) * Math.cos(e) * s);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: softTexture('glow'), color, size: 0.35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    this._bursts.push({ pts, v, life: 0, n });
  }

  // =========================================================================================
  //  Simulation
  // =========================================================================================
  /** Fixed substep: only things that interact physically with the player. */
  step(dt) {
    this.t += dt;
    for (const m of this.movers) {
      const o = m.fn(this.t);
      const b = m.plat.base;
      m.plat.setPos(b.x + (o.x || 0), b.y + (o.y || 0), b.z + (o.z || 0));
    }
    for (const h of this.hazards) {
      if (h.move && h.enabled) {
        const o = h.move(this.t);
        h.body.setCenter(h.base.x + (o.x || 0), h.base.y + (o.y || 0), h.base.z + (o.z || 0));
        h.group.position.set(h.body.x, h.body.y, h.body.z);
      }
    }
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.t >= this.timers[i].t) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }
    }
    for (const u of this.updaters) u(dt, this.t);
  }

  /** After physics: kill volumes, triggers, wind. */
  resolveInteractions(player, hazardShrink = 0.1) {
    // wind
    let ax = 0, az = 0, windAmt = 0;
    for (const w of this.winds) {
      let on = true;
      if (w.period > 0) on = ((this.t + w.phase) % w.period) < w.on;
      w.active = on;
      if (on && playerTouches(player, w.body, 0)) { ax += w.dx * w.strength; az += w.dz * w.strength; windAmt = 1; }
    }
    this.extraAccel.x = ax; this.extraAccel.z = az; this.windAmt = windAmt;

    for (const h of this.hazards) {
      if (!h.enabled) continue;
      if (playerTouches(player, h.body, hazardShrink)) return 'hazard';
    }
    for (const t of this.triggers) {
      if (!t.enabled) continue;
      const inside = playerTouches(player, t.body, 0);
      if (inside && !t.inside) {
        t.inside = true;
        if (!(t.once && t.fired)) { t.fired = true; if (t.onEnter) t.onEnter(); }
      } else if (!inside && t.inside) {
        t.inside = false;
        if (t.onExit) t.onExit();
      }
      if (inside && t.onStay) t.onStay();
    }
    return null;
  }

  /** Per rendered frame: visuals only. */
  frame(dt, player, camera) {
    // sky follows the camera
    this.sky.position.copy(camera.position);
    this.skyUniforms.uTime.value += dt;

    // sun / shadow follows the player, snapped to shadow texels
    const tgt = new V3(player.x, player.y, player.z);
    const dir = this.sunDir;
    const right = new V3().crossVectors(new V3(0, 1, 0), dir).normalize();
    const up = new V3().crossVectors(dir, right).normalize();
    const texel = 92 / 2048;
    const a = tgt.dot(right), b = tgt.dot(up);
    tgt.addScaledVector(right, Math.round(a / texel) * texel - a).addScaledVector(up, Math.round(b / texel) * texel - b);
    this.sun.target.position.copy(tgt);
    this.sun.position.copy(tgt).addScaledVector(dir, 120);

    // motes drift in a box around the camera
    if (this.motes) {
      const pa = this.motes.geometry.attributes.position, s = this._moteSeed, cp = camera.position, N = pa.count, T = this.t * 0.07;
      for (let i = 0; i < N; i++) {
        const R = 36;
        const x = ((s[i * 3] + T * (0.6 + s[i * 3 + 1] * 0.5)) * R * 2) % (R * 2);
        const y = ((s[i * 3 + 1] + T * 0.25) * R * 2) % (R * 2);
        const z = ((s[i * 3 + 2] - T * 0.4) * R * 2) % (R * 2);
        pa.setXYZ(i,
          cp.x + ((((x - cp.x) % (R * 2)) + R * 3) % (R * 2)) - R,
          cp.y + ((((y - cp.y) % (R * 2)) + R * 3) % (R * 2)) - R,
          cp.z + ((((z - cp.z) % (R * 2)) + R * 3) % (R * 2)) - R);
      }
      pa.needsUpdate = true;
    }

    // blob shadow
    const gy = groundBelow(this.bodies, player.x, player.z, player.y, 0.25);
    if (gy > -Infinity && player.y - gy < 40) {
      this.blob.visible = true;
      this.blob.position.set(player.x, gy + 0.025, player.z);
      const k = 1 + Math.min(1.2, (player.y - gy) * 0.1);
      this.blob.scale.setScalar(k);
      this.blob.material.opacity = Math.max(0.25, 0.9 - (player.y - gy) * 0.04);
    } else this.blob.visible = false;

    // wind streaks
    for (const w of this.winds) {
      const { lines, seeds, n } = w.streaks;
      lines.material.opacity += ((w.active ? 0.5 : 0) - lines.material.opacity) * Math.min(1, dt * 6);
      if (lines.material.opacity < 0.01) continue;
      const pos = lines.geometry.attributes.position, b = w.body;
      const len = 3.2;
      for (let i = 0; i < n; i++) {
        const s = seeds[i];
        const prog = (s[0] + this.t * (0.9 + s[1])) % 1;
        const along = (prog - 0.5);
        const px = b.x + (w.dx !== 0 ? along * b.hx * 2 : (s[1] - 0.5) * b.hx * 2);
        const pz = b.z + (w.dz !== 0 ? along * b.hz * 2 : (s[1] - 0.5) * b.hz * 2);
        const py = b.y + (s[2] - 0.5) * b.hy * 2;
        pos.setXYZ(i * 2, px, py, pz);
        pos.setXYZ(i * 2 + 1, px + w.dx * len, py, pz + w.dz * len);
      }
      pos.needsUpdate = true;
    }

    // goal / checkpoint ambient animation is handled by updaters; bursts here
    for (let i = this._bursts.length - 1; i >= 0; i--) {
      const bu = this._bursts[i];
      bu.life += dt;
      const pa = bu.pts.geometry.attributes.position;
      for (let j = 0; j < bu.n; j++) {
        bu.v[j * 3 + 1] -= 12 * dt;
        pa.setXYZ(j, pa.getX(j) + bu.v[j * 3] * dt, pa.getY(j) + bu.v[j * 3 + 1] * dt, pa.getZ(j) + bu.v[j * 3 + 2] * dt);
      }
      pa.needsUpdate = true;
      bu.pts.material.opacity = Math.max(0, 1 - bu.life / 1.4);
      if (bu.life > 1.4) { this.scene.remove(bu.pts); bu.pts.geometry.dispose(); bu.pts.material.dispose(); this._bursts.splice(i, 1); }
    }
  }

  /** Called when the player respawns: reset resettable level state. */
  onPlayerRespawn() {
    for (const f of this.respawnHooks) f();
    for (const t of this.triggers) {
      if (t.inside) { t.inside = false; if (t.onExit) t.onExit(); } // leaving by teleport still counts as leaving
      if (t.resetOnRespawn) t.fired = false;
    }
  }

  dispose() {
    for (const f of this.disposers) { try { f(); } catch { /* best effort */ } }
    this._envRT?.dispose();
    for (const t of this.ownTextures) t.dispose();
    this.scene.traverse((o) => {
      if (o.isMesh || o.isLine || o.isPoints) {
        // free every geometry this level made (cached box shapes are cleared below, so nothing else shares them)
        o.geometry?.dispose();
        if (o.isInstancedMesh) o.dispose();
      }
    });
    disposeGeometryCaches();   // the next level rebuilds the box shapes it needs
  }
}
