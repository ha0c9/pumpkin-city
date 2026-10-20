// Water surface: GPU ripples + planar reflection + screen-space refraction + depth-based color.
import { WATER, TERRAIN, QUALITY } from '../config/world.config.js';
import { RippleSimulation } from './RippleSimulation.js';
import { NOISE_GLSL } from './Terrain.js';

const THREE = window.THREE;

export const LAYER_DETAIL = 1; // grass & rain: skipped in reflection/refraction passes

const WATER_VS = /* glsl */`
uniform sampler2D uSimTex;
uniform vec4 uSimBounds;
uniform float uTime;
uniform float uSwell;
varying vec3 vWorldPos;
varying vec2 vSimUv;
varying float vSimMask;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 suv = (wp.xz - uSimBounds.xy) / uSimBounds.zw;
  vec2 edge = min(suv, 1.0 - suv);
  float mask = smoothstep(0.0, 0.06, min(edge.x, edge.y));
  float h = 0.0;
  if (mask > 0.0) h = texture2D(uSimTex, suv).r * mask;
  h += (sin(wp.x * 0.045 + uTime * 0.7) * 0.5 + sin(wp.z * 0.06 - uTime * 0.55 + wp.x * 0.02) * 0.4) * uSwell;
  wp.y += h;
  vWorldPos = wp.xyz;
  vSimUv = suv;
  vSimMask = mask;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const WATER_FS = /* glsl */`
uniform sampler2D uSimTex;
uniform sampler2D uDepthTex;
uniform sampler2D uReflTex;
uniform sampler2D uRefrTex;
uniform mat4 uReflMatrix;
uniform vec2 uResolution;
uniform float uTerrainSize;
uniform float uMaxDepth;
uniform float uTime;
uniform float uRain;
uniform float uExposure;
uniform vec3 uShallow;
uniform vec3 uMid;
uniform vec3 uDeep;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform float uDetail;
varying vec3 vWorldPos;
varying vec2 vSimUv;
varying float vSimMask;
#include <fog_pars_fragment>
${NOISE_GLSL}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Analytic gradient of a sum of directional waves (small-scale chop).
vec2 waveGrad(vec2 p, float t) {
  vec2 g = vec2(0.0);
  const int N = 6;
  vec2 dirs[6];
  dirs[0] = normalize(vec2(1.0, 0.3)); dirs[1] = normalize(vec2(-0.4, 1.0));
  dirs[2] = normalize(vec2(0.7, -0.8)); dirs[3] = normalize(vec2(-1.0, -0.2));
  dirs[4] = normalize(vec2(0.2, 0.9)); dirs[5] = normalize(vec2(0.9, 0.6));
  float freq = 0.35; float amp = 0.05;
  for (int i = 0; i < N; i++) {
    float ph = dot(dirs[i], p) * freq + t * sqrt(9.8 * freq) * 0.6;
    g += dirs[i] * cos(ph) * freq * amp;
    freq *= 1.63; amp *= 0.62;
  }
  return g;
}

vec2 noiseGrad(vec2 p) {
  float e = 0.15;
  float c = vnoise(p);
  return vec2(vnoise(p + vec2(e, 0.0)) - c, vnoise(p + vec2(0.0, e)) - c) / e;
}

// Expanding rain rings (procedural), returns a normal perturbation.
vec2 rainRipples(vec2 uv, float t) {
  vec2 p0 = floor(uv);
  vec2 circles = vec2(0.0);
  for (int j = -1; j <= 1; ++j) {
    for (int i = -1; i <= 1; ++i) {
      vec2 pi = p0 + vec2(float(i), float(j));
      vec2 hsh = hash22(pi);
      vec2 p = pi + hash22(hsh);
      float tt = fract(0.9 * t + hsh.x);
      vec2 v = p - uv;
      float d = length(v) - 2.0 * tt;
      float h = 1e-3;
      float d1 = d - h; float d2 = d + h;
      float p1 = sin(31.0 * d1) * smoothstep(-0.6, -0.3, d1) * smoothstep(0.0, -0.3, d1);
      float p2 = sin(31.0 * d2) * smoothstep(-0.6, -0.3, d2) * smoothstep(0.0, -0.3, d2);
      circles += 0.5 * normalize(v + 1e-4) * ((p2 - p1) / (2.0 * h) * (1.0 - tt) * (1.0 - tt));
    }
  }
  return circles / 9.0;
}

vec3 aces(vec3 x) {
  x *= uExposure;
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 toCam = cameraPosition - vWorldPos;
  float dist = length(toCam);
  vec3 V = toCam / dist;

  // --- Normal: simulation + chop + rain ---
  vec2 slope = vec2(0.0);
  if (vSimMask > 0.0) {
    vec2 simN = texture2D(uSimTex, vSimUv).ba;
    slope -= simN * vSimMask * 1.4;
  }
  float detailFade = 1.0 - smoothstep(150.0, 700.0, dist);
  slope += waveGrad(vWorldPos.xz, uTime) * (0.6 + 0.4 * detailFade);
  slope += (noiseGrad(vWorldPos.xz * 0.35 + vec2(uTime * 0.15, uTime * 0.07)) +
            noiseGrad(vWorldPos.xz * 0.9 - vec2(uTime * 0.11, -uTime * 0.13)) * 0.5) * 0.045 * uDetail * detailFade;
  if (uRain > 0.01 && dist < 90.0) {
    vec2 rr = rainRipples(vWorldPos.xz * 2.2, uTime) + rainRipples(vWorldPos.xz * 1.6 + 7.3, uTime * 1.13);
    slope += rr * 0.35 * uRain * (1.0 - smoothstep(30.0, 90.0, dist));
  }
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));

  // --- Depth from baked seabed ---
  vec2 duv = vWorldPos.xz / uTerrainSize + 0.5;
  float dEnc = texture2D(uDepthTex, duv).r;
  float depth = dEnc * dEnc * uMaxDepth;
  if (duv.x < 0.0 || duv.x > 1.0 || duv.y < 0.0 || duv.y > 1.0) depth = uMaxDepth;

  vec3 waterCol = mix(uShallow, uMid, smoothstep(0.4, 4.5, depth));
  waterCol = mix(waterCol, uDeep, smoothstep(4.5, 14.0, depth));
  float sunUp = clamp(uSunDir.y * 3.0, 0.0, 1.0);
  vec3 lightCol = uAmbient + uSunColor * sunUp * 0.6;
  vec3 scatter = aces(waterCol * lightCol);

  // --- Refraction ---
  vec2 screenUv = gl_FragCoord.xy / uResolution;
  float refrStrength = 0.035 * clamp(depth / 2.0, 0.15, 1.0) / (1.0 + dist * 0.01);
  vec3 refr = texture2D(uRefrTex, clamp(screenUv + N.xz * refrStrength, 0.001, 0.999)).rgb;
  float viewDepth = depth / max(V.y, 0.12);
  float clarity = exp(-viewDepth * 0.22) * (1.0 - uRain * 0.35);
  vec3 below = mix(scatter, refr * mix(vec3(1.0), waterCol * 1.6 + 0.25, 0.35), clarity);

  // --- Reflection ---
  vec4 rp = uReflMatrix * vec4(vWorldPos.x, 0.0, vWorldPos.z, 1.0);
  vec2 reflUv = rp.xy / rp.w * 0.5 + 0.5;
  reflUv += N.xz * 0.06 / (1.0 + dist * 0.004);
  vec3 refl = texture2D(uReflTex, clamp(reflUv, 0.001, 0.999)).rgb;

  float cosT = clamp(dot(N, V), 0.0, 1.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  fresnel = clamp(fresnel, 0.0, 0.92);
  vec3 col = mix(below, refl, fresnel);

  // --- Sun glint ---
  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(N, H), 0.0);
  float spec = pow(nh, 900.0) * 6.0 + pow(nh, 120.0) * 0.35;
  col += aces(uSunColor * spec * sunUp * (1.0 - uRain * 0.85));

  // --- Shore foam ---
  float foamBand = smoothstep(0.9, 0.05, depth);
  float waveLines = sin(depth * 9.0 - uTime * 2.2 + vnoise(vWorldPos.xz * 0.4) * 4.0) * 0.5 + 0.5;
  float foamNoise = vnoise(vWorldPos.xz * 1.3 + uTime * 0.3) * vnoise(vWorldPos.xz * 0.5 - uTime * 0.2);
  float foam = foamBand * smoothstep(0.35, 0.85, waveLines * 0.6 + foamNoise * 0.9);
  foam = max(foam, smoothstep(0.25, 0.0, depth) * 0.8);
  col = mix(col, aces(lightCol * 1.05), clamp(foam, 0.0, 1.0) * 0.85);

  float alpha = smoothstep(0.0, 0.12, depth);
  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
  #include <encodings_fragment>
}
`;

export class Water {
  constructor(ctx, terrain) {
    this.ctx = ctx;
    const { renderer } = ctx;
    const simSize = WATER.simSize;
    this.simBounds = new THREE.Vector4(-simSize / 2, -simSize / 2, simSize, simSize);
    this.sim = new RippleSimulation(renderer, {
      resolution: QUALITY.simResolution,
      bounds: this.simBounds,
      landTexture: terrain.depthTexture,
      terrainSize: TERRAIN.size,
    });
    ctx.uniforms.uSimTex.value = this.sim.texture;
    ctx.uniforms.uSimBounds.value = this.simBounds;

    this.reflRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType });
    this.refrRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType });
    this.mirrorCam = new THREE.PerspectiveCamera();
    this.reflMatrix = new THREE.Matrix4();

    const u = ctx.uniforms;
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uSimTex: { value: null }, uDepthTex: { value: terrain.depthTexture },
      uReflTex: { value: this.reflRT.texture }, uRefrTex: { value: this.refrRT.texture },
      uReflMatrix: { value: this.reflMatrix }, uResolution: { value: new THREE.Vector2(1, 1) },
      uTerrainSize: { value: TERRAIN.size }, uMaxDepth: { value: WATER.maxDepth },
      uShallow: { value: new THREE.Vector3(...WATER.shallowColor) },
      uMid: { value: new THREE.Vector3(...WATER.midColor) },
      uDeep: { value: new THREE.Vector3(...WATER.deepColor) },
      uExposure: { value: 1 }, uSwell: { value: 0.06 }, uDetail: { value: 1 },
    }]);
    // Share live uniforms with the rest of the world.
    this.uniforms.uTime = u.uTime;
    this.uniforms.uRain = u.uRain;
    this.uniforms.uSunDir = u.uSunDir;
    this.uniforms.uSunColor = u.uSunColor;
    this.uniforms.uAmbient = u.uAmbient;
    this.uniforms.uSimBounds = u.uSimBounds;

    this.material = new THREE.ShaderMaterial({
      vertexShader: WATER_VS, fragmentShader: WATER_FS, uniforms: this.uniforms,
      fog: true, transparent: true, toneMapped: false,
    });
    const geo = this._buildGeometry();
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'water';
    this.mesh.userData.isWater = true;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    ctx.scene.add(this.mesh);

    this.clipAbove = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.05)];
    this.clipBelow = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.8)];
    this._tmp = { v: new THREE.Vector3(), t: new THREE.Vector3(), up: new THREE.Vector3(), color: new THREE.Color() };
  }

  /** Dense grid over the simulated region, coarse ring outside it. */
  _buildGeometry() {
    const inner = new THREE.PlaneGeometry(WATER.simSize, WATER.simSize, QUALITY.waterSegments, QUALITY.waterSegments);
    inner.rotateX(-Math.PI / 2);
    const parts = [inner];
    const S = WATER.size, s = WATER.simSize;
    const band = (S - s) / 2;
    const add = (w, d, x, z) => {
      const g = new THREE.PlaneGeometry(w, d, 8, 8); g.rotateX(-Math.PI / 2); g.translate(x, 0, z); parts.push(g);
    };
    add(S, band, 0, -(s / 2 + band / 2));
    add(S, band, 0, s / 2 + band / 2);
    add(band, s, -(s / 2 + band / 2), 0);
    add(band, s, s / 2 + band / 2, 0);
    const arrays = parts.map((p) => p.toNonIndexed().attributes.position.array);
    const positions = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
    let offset = 0;
    for (const a of arrays) { positions.set(a, offset); offset += a.length; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }

  setSize(width, height, pixelRatio) {
    const w = Math.max(2, Math.floor(width * pixelRatio));
    const h = Math.max(2, Math.floor(height * pixelRatio));
    this.uniforms.uResolution.value.set(w, h);
    this.reflRT.setSize(Math.floor(w * QUALITY.reflectionScale), Math.floor(h * QUALITY.reflectionScale));
    this.refrRT.setSize(Math.floor(w * QUALITY.refractionScale), Math.floor(h * QUALITY.refractionScale));
  }

  addDrop(x, z, radius, strength) { this.sim.addDrop(x, z, radius, strength); }

  update(dt) {
    this.sim.step(1);
    this.uniforms.uSimTex.value = this.sim.texture;
    this.ctx.uniforms.uSimTex.value = this.sim.texture;
    this.uniforms.uExposure.value = this.ctx.renderer.toneMappingExposure;
    this.uniforms.uSwell.value = 0.05 + this.ctx.uniforms.uRain.value * 0.08;
  }

  /** Render reflection and refraction textures. Call before the main render. */
  renderPasses(scene, camera, skyMesh) {
    const r = this.ctx.renderer;
    const { v, t, up, color } = this._tmp;
    const prevClip = r.clippingPlanes;
    const prevTarget = r.getRenderTarget();
    r.getClearColor(color);
    const prevAlpha = r.getClearAlpha();
    this.mesh.visible = false;

    // Reflection: mirror the camera across y = 0.
    const mc = this.mirrorCam;
    mc.copy(camera, false);
    camera.getWorldDirection(t);
    v.copy(camera.position);
    mc.position.set(v.x, -v.y, v.z);
    t.add(v);
    t.y = -t.y;
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    up.y = -up.y;
    mc.up.copy(up);
    mc.lookAt(t);
    mc.near = camera.near; mc.far = camera.far; mc.fov = camera.fov; mc.aspect = camera.aspect;
    mc.updateProjectionMatrix();
    mc.updateMatrixWorld();
    mc.layers.set(0);
    if (skyMesh) skyMesh.position.copy(mc.position);
    this.reflMatrix.multiplyMatrices(mc.projectionMatrix, mc.matrixWorldInverse);

    r.clippingPlanes = this.clipAbove;
    r.setRenderTarget(this.reflRT);
    r.clear();
    r.render(scene, mc);

    // Refraction: only what lies below (or barely above) the surface.
    if (skyMesh) skyMesh.visible = false;
    const prevLayers = camera.layers.mask;
    camera.layers.set(0);
    r.clippingPlanes = this.clipBelow;
    const deep = WATER.deepColor;
    r.setClearColor(new THREE.Color(deep[0], deep[1], deep[2]).multiplyScalar(0.6), 1);
    r.setRenderTarget(this.refrRT);
    r.clear();
    r.render(scene, camera);
    camera.layers.mask = prevLayers;
    if (skyMesh) { skyMesh.visible = true; skyMesh.position.copy(camera.position); }

    r.clippingPlanes = prevClip;
    r.setRenderTarget(prevTarget);
    r.setClearColor(color, prevAlpha);
    this.mesh.visible = true;
  }
}
