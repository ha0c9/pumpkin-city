// Procedural sky dome (gradient, sun, moon, stars, clouds) + PMREM environment map for reflections.
import { SKY } from '../config/world.config.js';
import { NOISE_GLSL } from './Terrain.js';

const THREE = window.THREE;

const SKY_VS = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const SKY_FS = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uDaylight;
uniform float uSunset;
uniform float uRain;
uniform float uStorm;
uniform float uTime;
uniform vec3 uDayZenith, uDayHorizon, uSunsetHorizon, uNightZenith, uNightHorizon;
uniform float uSunDisk;
uniform float uScale;
uniform vec3 uFogColor;
uniform float uHorizonFog;
varying vec3 vDir;
${NOISE_GLSL}
float fbm5(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.07 + 13.1; a *= 0.5; }
  return v;
}
void main() {
  vec3 dir = normalize(vDir);
  float y = dir.y;
  float yc = max(y, 0.0);
  float horizonT = pow(1.0 - yc, 4.0);
  float sunAmt = max(dot(dir, uSunDir), 0.0);

  vec3 day = mix(uDayZenith, uDayHorizon, horizonT);
  float sunsetMix = uSunset * horizonT * (0.35 + 0.65 * pow(sunAmt, 3.0));
  day = mix(day, uSunsetHorizon, clamp(sunsetMix, 0.0, 1.0));
  vec3 night = mix(uNightZenith, uNightHorizon, horizonT);
  vec3 col = mix(night, day, uDaylight);

  // Overcast tint when raining.
  vec3 overcast = mix(vec3(0.36, 0.39, 0.43), vec3(0.55, 0.58, 0.62), horizonT) * (0.15 + 0.85 * uDaylight);
  col = mix(col, overcast, uRain * 0.85);
  col *= 1.0 - uStorm * 0.45;

  // Stars.
  if (uDaylight < 0.6 && y > 0.0) {
    vec3 sd = dir * 300.0;
    vec2 cell = floor(sd.xz / (sd.y + 60.0) * 120.0);
    float h = hash12(cell);
    float twinkle = 0.6 + 0.4 * sin(uTime * 3.0 + h * 50.0);
    float star = step(0.9965, h) * twinkle * (1.0 - uDaylight / 0.6) * (1.0 - uRain);
    col += vec3(star) * 1.6 * smoothstep(0.0, 0.25, y);
  }

  // Sun disk + glow.
  float sunVis = smoothstep(-0.08, 0.02, uSunDir.y) * (1.0 - uRain * 0.92);
  vec3 sunCol = mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.95, 0.85), smoothstep(0.0, 0.35, uSunDir.y));
  col += sunCol * (smoothstep(0.99955, 0.99975, sunAmt) * 40.0 * uSunDisk + pow(sunAmt, 10.0) * 0.35 + pow(sunAmt, 120.0) * 1.2 * uSunDisk) * sunVis;

  // Moon.
  float moonAmt = max(dot(dir, uMoonDir), 0.0);
  float moonVis = (1.0 - uDaylight) * smoothstep(-0.05, 0.05, uMoonDir.y) * (1.0 - uRain * 0.9);
  col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.99925, 0.9995, moonAmt) * 3.0 + pow(moonAmt, 60.0) * 0.12) * moonVis;

  // Clouds on a virtual plane.
  if (y > 0.0) {
    vec2 cuv = dir.xz / (y + 0.12) * 1.6 + vec2(uTime * 0.012, uTime * 0.004) * (1.0 + uStorm * 7.0);
    float n = fbm5(cuv);
    float coverage = mix(0.56, 0.18, uRain) - uStorm * 0.12;
    float cloud = smoothstep(coverage, coverage + 0.28, n) * smoothstep(0.0, 0.18, y);
    vec3 lit = mix(vec3(1.0), sunCol * 1.15, uSunset * 0.6) * (0.25 + 0.95 * uDaylight);
    vec3 shade = mix(vec3(0.55, 0.6, 0.68), vec3(0.32, 0.34, 0.38), uRain) * (0.08 + 0.8 * uDaylight);
    vec3 cloudCol = mix(lit, shade, smoothstep(0.4, 0.95, n) * 0.8 + uRain * 0.3);
    cloudCol *= 1.0 - uStorm * smoothstep(0.35, 0.9, n) * 0.6;
    cloudCol += sunCol * pow(sunAmt, 6.0) * 0.4 * uDaylight * (1.0 - uRain);
    col = mix(col, cloudCol, cloud * 0.92);
  }

  // Below horizon: blend to a hazy horizon color.
  if (y < 0.0) col = mix(col, col * 0.6, smoothstep(0.0, -0.3, y));

  gl_FragColor = vec4(col * uScale, 1.0);
  #include <tonemapping_fragment>
  // Fully fogged water ends at the camera far plane; below the horizon the sky takes the
  // fog color too, so that edge never shows as a line.
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, uHorizonFog * (1.0 - smoothstep(-0.02, 0.07, y)));
  #include <encodings_fragment>
}
`;

export class Sky {
  constructor(ctx) {
    this.ctx = ctx;
    const u = ctx.uniforms;
    const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    this.uniforms = {
      uSunDir: u.uSunDir, uMoonDir: u.uMoonDir, uDaylight: u.uDaylight, uSunset: u.uSunset,
      uRain: u.uRain, uStorm: u.uStorm, uTime: u.uTime,
      uDayZenith: { value: v3(SKY.dayZenith) }, uDayHorizon: { value: v3(SKY.dayHorizon) },
      uSunsetHorizon: { value: v3(SKY.sunsetHorizon) },
      uNightZenith: { value: v3(SKY.nightZenith) }, uNightHorizon: { value: v3(SKY.nightHorizon) },
      uSunDisk: { value: 1 }, uScale: { value: 1 },
      uFogColor: { value: new THREE.Color(1, 1, 1) }, uHorizonFog: { value: 1 },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.uniforms,
      side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), this.material);
    this.mesh.name = 'sky';
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
    ctx.scene.add(this.mesh);

    this.envScene = new THREE.Scene();
    // The environment bake skips the sun disk: direct sunlight comes from the shadow-casting light.
    this.envMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_VS, fragmentShader: SKY_FS,
      uniforms: { ...this.uniforms, uSunDisk: { value: 0 }, uScale: { value: 0.75 }, uHorizonFog: { value: 0 } },
      side: THREE.BackSide, depthWrite: false,
    });
    this.envMesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.envMaterial);
    this.envScene.add(this.envMesh);
    this.pmrem = new THREE.PMREMGenerator(ctx.renderer);
    this.envRT = null;
    this._lastKey = '';
  }

  /** Re-bake the environment map when lighting changed noticeably. */
  updateEnvironment(force = false) {
    const u = this.ctx.uniforms;
    const key = [u.uDaylight.value.toFixed(2), u.uSunset.value.toFixed(2), u.uRain.value.toFixed(2), u.uStorm.value.toFixed(2),
      u.uSunDir.value.x.toFixed(1), u.uSunDir.value.z.toFixed(1)].join('|');
    if (!force && key === this._lastKey) return false;
    this._lastKey = key;
    const prevClip = this.ctx.renderer.clippingPlanes;
    this.ctx.renderer.clippingPlanes = [];
    const rt = this.pmrem.fromScene(this.envScene, 0.02);
    this.ctx.renderer.clippingPlanes = prevClip;
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.ctx.scene.environment = rt.texture;
    return true;
  }

  follow(camera) { this.mesh.position.copy(camera.position); }
}
