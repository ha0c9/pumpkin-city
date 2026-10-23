// Time of day, weather (sunny / rain), lights, fog and GPU rain particles.
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
varying float vAlpha;
void main() {
  vec3 p = position;
  float speed = 22.0 + fract(p.x * 13.17) * 6.0;
  p.y = mod(p.y - uTime * speed, uHeight);
  p.x = mod(p.x - uCenter.x + uTime * 1.5, uBox) - uBox * 0.5 + uCenter.x;
  p.z = mod(p.z - uCenter.z, uBox) - uBox * 0.5 + uCenter.z;
  p.y += uCenter.y - uHeight * 0.45;
  p += aEnd * vec3(0.04, 0.55, 0.0);
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
      uHeight: { value: height }, uRain: this.ctx.uniforms.uRain, uColor: { value: new THREE.Color(0xaabbcc) },
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
    const target = this.weather === 'rain' ? 1 : 0;
    this.rain += (target - this.rain) * Math.min(1, dt * 0.6);
    if (Math.abs(target - this.rain) < 0.002) this.rain = target;
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
    const rain = this.rain;

    // Sun / moon light.
    const sunUp = sunDir.y > -0.02;
    const lightDir = sunUp ? sunDir : u.uMoonDir.value;
    const warm = new THREE.Color().setRGB(1.0, lerp(0.55, 0.96, smoothstep(0.0, 0.4, sunDir.y)), lerp(0.3, 0.9, smoothstep(0.0, 0.45, sunDir.y)));
    if (sunUp) {
      this.sun.color.copy(warm);
      this.sun.intensity = 2.8 * smoothstep(-0.02, 0.12, sunDir.y) * (1 - rain * 0.78);
    } else {
      this.sun.color.setRGB(0.55, 0.65, 0.95);
      this.sun.intensity = 0.32 * smoothstep(-0.02, 0.2, u.uMoonDir.value.y) * (1 - rain * 0.7);
    }
    u.uSunColor.value.set(this.sun.color.r, this.sun.color.g, this.sun.color.b).multiplyScalar(Math.max(this.sun.intensity, 0) * 0.55);
    const center = focus || new THREE.Vector3();
    this.sun.position.copy(center).addScaledVector(lightDir, 300);
    this.sun.target.position.copy(center);
    this.sun.target.updateMatrixWorld();

    // Ambient.
    const skyDay = new THREE.Color().setRGB(...SKY.dayHorizon);
    const skyNight = new THREE.Color(0x1a2850);
    this.hemi.color.copy(skyNight).lerp(skyDay, daylight);
    this.hemi.groundColor.setRGB(0.25, 0.27, 0.18).multiplyScalar(0.25 + 0.75 * daylight);
    this.hemi.intensity = lerp(0.3, 0.42, daylight) * (1 - rain * 0.1);
    const amb = this.hemi.color.clone().multiplyScalar(this.hemi.intensity * 0.6);
    u.uAmbient.value.set(amb.r, amb.g, amb.b);
    u.uWaterTint.value.set(...WATER.midColor).multiplyScalar(1.4).addScalar(0.25);

    // Fog matches the horizon.
    const fogDay = new THREE.Color().setRGB(...SKY.dayHorizon);
    const fogSunset = new THREE.Color().setRGB(...SKY.sunsetHorizon).lerp(fogDay, 0.45);
    const fogNight = new THREE.Color().setRGB(...SKY.nightHorizon);
    const fog = fogNight.clone().lerp(fogDay.lerp(fogSunset, sunset * 0.6), daylight);
    fog.lerp(new THREE.Color(0.5, 0.53, 0.57).multiplyScalar(0.2 + 0.8 * daylight), rain * 0.8);
    this.ctx.scene.fog.color.copy(fog);
    this.ctx.scene.fog.density = lerp(0.00055, 0.0032, rain);

    this.ctx.renderer.toneMappingExposure = lerp(1.45, 1.0, daylight);

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
    const n = Math.floor(10 * this.rain);
    for (let i = 0; i < n; i++) {
      const x = focus.x + (this.rng() - 0.5) * 160;
      const z = focus.z + (this.rng() - 0.5) * 160;
      water.addDrop(x, z, 0.9 + this.rng() * 0.8, 0.02 + this.rng() * 0.03);
    }
  }
}
