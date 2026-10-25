import * as THREE from 'three';

// Lowtide's screen pass (runs after tone mapping): chromatic aberration, film grain, a breathing vignette, glitch tears, damage and fade.
export const HORROR_SHADER = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1280, 720) },
    uVig: { value: 0.5 }, uGrain: { value: 0.07 }, uAber: { value: 0.0018 }, uDesat: { value: 0.12 }, uPulse: { value: 0 }, uGlitch: { value: 0 }, uFade: { value: 0 }, uDamage: { value: 0 },
    uTint: { value: new THREE.Vector3(0.86, 1, 0.94) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uAber, uDesat, uPulse, uGlitch, uFade, uDamage; uniform vec2 uRes; uniform vec3 uTint;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv, d = uv - 0.5;
      float row = floor(uv.y * 70.0), tt = floor(uTime * 16.0);
      float tear = step(0.975, h(vec2(row, tt))) * uGlitch;
      uv.x += tear * 0.08 * (h(vec2(tt, row)) - 0.5);
      float r2 = dot(d, d);
      vec2 off = d * (uAber * (1.0 + uGlitch * 7.0)) * (0.4 + r2 * 3.2);
      vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(l) * uTint, uDesat);
      float v = smoothstep(0.92, 0.18, length(d * vec2(1.0, 0.9)));
      col *= mix(1.0, v, clamp(uVig + uPulse * 0.4, 0.0, 1.0));
      col = mix(col, col * vec3(1.35, 0.3, 0.3) + vec3(0.06, 0.0, 0.0), uDamage * smoothstep(0.15, 0.75, length(d)));
      col += (h(uv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain * (1.1 - l * 0.7);
      col *= 1.0 - uFade;
      gl_FragColor = vec4(col, 1.0);
    }`,
};
