// Time of day, weather (sunny / rain / typhoon), lights, fog, lightning and GPU rain particles.
import { QUALITY, START_TIME, SKY, WATER } from '../config/world.config.js';
import { smoothstep, lerp, mulberry32 } from '../core/Utils.js';
import { LAYER_DETAIL } from './Water.js';

const THREE = window.THREE;

const RAIN_VS = /* glsl */`
attribute float aEnd;
uniform float uTime;
uniform vec3 uCenter;
uniform float uBox;
uniform float uHeight;
uniform float uRain;
uniform float uStorm;
varying float vAlpha;
void main() {
  vec3 p = position;
  float speed = 22.0 + fract(p.x * 13.17) * 6.0 + uStorm * 10.0;
  p.y = mod(p.y - uTime * speed, uHeight);
  p.x = mod(p.x - uCenter.x + uTime * (1.5 + uStorm * 34.0), uBox) - uBox * 0.5 + uCenter.x;
  p.z = mod(p.z - uCenter.z, uBox) - uBox * 0.5 + uCenter.z;
  p.y += uCenter.y - uHeight * 0.45;
  p += aEnd * vec3(0.04 + uStorm * 1.05, 0.55 + uStorm * 0.25, uStorm * 0.12);
  float visible = step(fract(position.z * 7.31), uRain);
  vAlpha = visible * (0.25 + 0.3 * aEnd);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;
const RAIN_FS = /* glsl */`
uniform vec3 uColor;
varying float vAlpha;
void main() {
  if (vAlpha <= 0.0) discard;
  gl_FragColor = vec4(uColor, vAlpha);
}
`;

export class Environment {
  constructor(ctx, sky) {
    this.ctx = ctx;
    this.sky = sky;
    this.time = START_TIME;
    this.autoTime = false;
    this.timeSpeed = 0.25; // in-game hours per real second when auto cycling
    this.weather = 'sunny';
    this.rain = 0;
    this.storm = 0;
    this.flash = 0;
    this._nextFlash = 3;
    this.listeners = [];
    this.rng = mulberry32(7);

    const { scene } = ctx;
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = true;
    const sm = QUALITY.shadowMapSize;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 600;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5b6b3a, 0.6);
    scene.add(this.hemi);

    scene.fog = new THREE.FogExp2(0xbfd5ea, 0.0007);
    this._buildRain();
    this._envTimer = 0;
    this._c = {
      warm: new THREE.Color(), skyDay: new THREE.Color(), skyNight: new THREE.Color(0x1a2850),
      amb: new THREE.Color(), fogDay: new THREE.Color(), fogSunset: new THREE.Color(),
      fogNight: new THREE.Color(), fog: new THREE.Color(), mix: new THREE.Color(),
    };
    this._origin = new THREE.Vector3();
    this.apply(0, true);
  }

  _buildRain() {
    const n = QUALITY.rainCount;
    const box = 90, height = 60;
    const pos = new Float32Array(n * 2 * 3);
    const end = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = this.rng() * box, y = this.rng() * height, z = this.rng() * box;
      for (let k = 0; k < 2; k++) {
        pos.set([x, y, z], (i * 2 + k) * 3);
        end[i * 2 + k] = k;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.rainUniforms = {
      uTime: this.ctx.uniforms.uTime, uCenter: { value: new THREE.Vector3() }, uBox: { value: box },
      uHeight: { value: height }, uRain: this.ctx.uniforms.uRain, uStorm: this.ctx.uniforms.uStorm, uColor: { value: new THREE.Color(0xaabbcc) },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: RAIN_VS, fragmentShader: RAIN_FS, uniforms: this.rainUniforms,
      transparent: true, depthWrite: false,
    });
    this.rainMesh = new THREE.LineSegments(geo, mat);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.layers.set(LAYER_DETAIL);
    this.rainMesh.visible = false;
    this.ctx.scene.add(this.rainMesh);
  }

  setTime(hours) { this.time = ((hours % 24) + 24) % 24; this.apply(0, false); }
  setWeather(w) { this.weather = w; this._emit(); }
  onChange(fn) { this.listeners.push(fn); }
  _emit() { this.listeners.forEach((fn) => fn(this)); }

  get isNight() { return this.ctx.uniforms.uNight.value > 0.5; }

  update(dt, camera, focus) {
    if (this.autoTime) {
      this.time = (this.time + dt * this.timeSpeed) % 24;
    }
    const target = this.weather === 'sunny' ? 0 : 1;
    this.rain += (target - this.rain) * Math.min(1, dt * 0.6);
    if (Math.abs(target - this.rain) < 0.002) this.rain = target;
    const stormTarget = this.weather === 'typhoon' ? 1 : 0;
    this.storm += (stormTarget - this.storm) * Math.min(1, dt * 0.35);
    if (Math.abs(stormTarget - this.storm) < 0.002) this.storm = stormTarget;
    // Lightning: a double flicker every few seconds during the typhoon.
    this.flash = Math.max(0, this.flash - dt * 3.2);
    if (this.storm > 0.6) {
      this._nextFlash -= dt;
      if (this._nextFlash <= 0) {
        this.flash = 1;
        this._flicker = 0.18;
        this._nextFlash = 3 + this.rng() * 7;
      }
      if (this._flicker > 0) {
        this._flicker -= dt;
        if (this._flicker <= 0) this.flash = Math.max(this.flash, 0.8);
      }
    }
    this.apply(dt, false, camera, focus);
  }

  apply(dt, force, camera, focus) {
    const u = this.ctx.uniforms;
    const a = (this.time - 6) / 12 * Math.PI;
    const sunDir = u.uSunDir.value.set(Math.cos(a), Math.sin(a) * 0.92, -0.38).normalize();
    const ma = a + Math.PI;
    u.uMoonDir.value.set(Math.cos(ma) * 0.8, Math.sin(ma) * 0.85 + 0.15, 0.45).normalize();
    const daylight = smoothstep(-0.14, 0.16, sunDir.y);
    const sunset = 1 - smoothstep(0.0, 0.32, Math.abs(sunDir.y + 0.02));
    u.uDaylight.value = daylight;
    u.uSunset.value = sunset;
    u.uNight.value = 1 - smoothstep(-0.06, 0.1, sunDir.y);
    u.uRain.value = this.rain;
    u.uStorm.value = this.storm;
    const rain = this.rain, storm = this.storm;

    // Sun / moon light.
    const sunUp = sunDir.y > -0.02;
    const lightDir = sunUp ? sunDir : u.uMoonDir.value;
    const warm = this._c.warm.setRGB(1.0, lerp(0.55, 0.96, smoothstep(0.0, 0.4, sunDir.y)), lerp(0.3, 0.9, smoothstep(0.0, 0.45, sunDir.y)));
    if (sunUp) {
      this.sun.color.copy(warm);
      this.sun.intensity = 2.8 * smoothstep(-0.02, 0.12, sunDir.y) * (1 - rain * 0.78) * (1 - storm * 0.6);
    } else {
      this.sun.color.setRGB(0.55, 0.65, 0.95);
      this.sun.intensity = 0.32 * smoothstep(-0.02, 0.2, u.uMoonDir.value.y) * (1 - rain * 0.7);
    }
    u.uSunColor.value.set(this.sun.color.r, this.sun.color.g, this.sun.color.b).multiplyScalar(Math.max(this.sun.intensity, 0) * 0.55);
    const center = focus || this._origin;
    this.sun.position.copy(center).addScaledVector(lightDir, 300);
    this.sun.target.position.copy(center);
    this.sun.target.updateMatrixWorld();

    // Ambient.
    const skyDay = this._c.skyDay.setRGB(...SKY.dayHorizon);
    const skyNight = this._c.skyNight;
    this.hemi.color.copy(skyNight).lerp(skyDay, daylight);
    this.hemi.groundColor.setRGB(0.25, 0.27, 0.18).multiplyScalar(0.25 + 0.75 * daylight);
    this.hemi.intensity = lerp(0.3, 0.42, daylight) * (1 - rain * 0.1) * (1 - storm * 0.3) + this.flash * 1.6;
    const amb = this._c.amb.copy(this.hemi.color).multiplyScalar(this.hemi.intensity * 0.6);
    u.uAmbient.value.set(amb.r, amb.g, amb.b);
    u.uWaterTint.value.set(...WATER.midColor).multiplyScalar(1.4).addScalar(0.25);

    // Fog matches the horizon. Same mutation order as the previous per-frame Color construction:
    // sunset is mixed into a copy of the day horizon, then that result is mixed by daylight.
    const fogDay = this._c.fogDay.setRGB(...SKY.dayHorizon);
    const fogSunset = this._c.fogSunset.setRGB(...SKY.sunsetHorizon).lerp(fogDay, 0.45);
    const fogNight = this._c.fogNight.setRGB(...SKY.nightHorizon);
    fogDay.lerp(fogSunset, sunset * 0.6);
    const fog = this._c.fog.copy(fogNight).lerp(fogDay, daylight);
    const mix = this._c.mix;
    fog.lerp(mix.setRGB(0.5, 0.53, 0.57).multiplyScalar(0.2 + 0.8 * daylight), rain * 0.8);
    fog.lerp(mix.setRGB(0.24, 0.27, 0.3).multiplyScalar(0.2 + 0.8 * daylight), storm * 0.7);
    fog.lerp(mix.setRGB(0.75, 0.8, 0.9), this.flash * 0.5);
    this.ctx.scene.fog.color.copy(fog);
    this.sky.uniforms.uFogColor.value.copy(fog);
    this.ctx.scene.fog.density = lerp(lerp(0.00055, 0.0032, rain), 0.0034, storm);

    this.ctx.renderer.toneMappingExposure = lerp(1.45, 1.0, daylight) + this.flash * 1.3;

    // Rain particles.
    this.rainMesh.visible = rain > 0.01;
    if (camera) this.rainUniforms.uCenter.value.copy(camera.position);
    this.rainUniforms.uColor.value.setRGB(0.6, 0.65, 0.72).multiplyScalar(0.35 + 0.65 * daylight);

    // Refresh the reflection environment occasionally.
    this._envTimer -= dt;
    if (force || this._envTimer <= 0) {
      if (this.sky.updateEnvironment(force)) this._envTimer = 0.6;
    }
  }

  /** Raindrops feed the ripple simulation around the camera focus. */
  feedRain(water, focus) {
    if (this.rain < 0.05) return;
    const n = Math.floor(10 * this.rain + 14 * this.storm);
    for (let i = 0; i < n; i++) {
      const x = focus.x + (this.rng() - 0.5) * 160;
      const z = focus.z + (this.rng() - 0.5) * 160;
      water.addDrop(x, z, 0.9 + this.rng() * 0.8, 0.02 + this.rng() * 0.03);
    }
  }
}
