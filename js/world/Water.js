// Water surface: GPU ripples + spectrum-based detail normals + planar reflection + screen-space
// refraction + depth-based color. The dense mesh and the ripple simulation follow the camera.
import { WATER, TERRAIN, QUALITY } from '../config/world.config.js';
import { RippleSimulation } from './RippleSimulation.js';
import { NOISE_GLSL } from './Terrain.js';
import { mulberry32 } from '../core/Utils.js';

const THREE = window.THREE;

export const LAYER_DETAIL = 1; // grass & rain: skipped in reflection/refraction passes

const SWELL_GLSL = /* glsl */`
// Three long Gerstner-like swells; returns height and writes the slope.
float swell(vec2 p, float t, out vec2 slope) {
  float h = 0.0; slope = vec2(0.0);
  vec2 d[3]; float L[3]; float A[3];
  d[0] = normalize(vec2(0.8, 0.6)); L[0] = 38.0; A[0] = 0.16;
  d[1] = normalize(vec2(-0.3, 1.0)); L[1] = 23.0; A[1] = 0.09;
  d[2] = normalize(vec2(1.0, -0.45)); L[2] = 14.0; A[2] = 0.05;
  for (int i = 0; i < 3; i++) {
    float k = 6.28318 / L[i];
    float w = sqrt(9.8 * k);
    float ph = k * dot(d[i], p) - w * t;
    h += A[i] * sin(ph);
    slope += d[i] * A[i] * k * cos(ph);
  }
  return h;
}
`;

const WATER_VS = /* glsl */`
uniform sampler2D uSimTex;
uniform sampler2D uDepthTex;
uniform vec4 uSimBounds;
uniform float uTerrainSize;
uniform float uMaxDepth;
uniform float uTime;
uniform float uSwell;
varying vec3 vWorldPos;
varying vec2 vSimUv;
varying float vSimMask;
varying float vSwellAmp;
#include <fog_pars_vertex>
${SWELL_GLSL}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 suv = (wp.xz - uSimBounds.xy) / uSimBounds.zw;
  vec2 edge = min(suv, 1.0 - suv);
  float mask = smoothstep(0.0, 0.06, min(edge.x, edge.y));
  float h = 0.0;
  if (mask > 0.0) h = texture2D(uSimTex, suv).r * mask;
  vec2 duv = wp.xz / uTerrainSize + 0.5;
  float dEnc = (duv.x < 0.0 || duv.y < 0.0 || duv.x > 1.0 || duv.y > 1.0) ? 1.0 : texture2D(uDepthTex, duv).r;
  float depth = dEnc * dEnc * uMaxDepth;
  float amp = uSwell * smoothstep(0.3, 6.0, depth);
  vec2 sl;
  h += swell(wp.xz, uTime, sl) * amp;
  wp.y += h;
  vWorldPos = wp.xyz;
  vSimUv = suv;
  vSimMask = mask;
  vSwellAmp = amp;
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
uniform sampler2D uWaveTex;
uniform mat4 uReflMatrix;
uniform vec2 uResolution;
uniform float uTerrainSize;
uniform float uMaxDepth;
uniform float uTime;
uniform float uRain;
uniform float uExposure;
uniform float uWaveSlope;
uniform float uWind;
uniform vec3 uShallow;
uniform vec3 uMid;
uniform vec3 uDeep;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
varying vec3 vWorldPos;
varying vec2 vSimUv;
varying float vSimMask;
varying float vSwellAmp;
#include <fog_pars_fragment>
${NOISE_GLSL}
${SWELL_GLSL}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec2 waveTex(vec2 uv) { return texture2D(uWaveTex, uv).rg * 2.0 - 1.0; }

// Detail slopes: one baked wave spectrum sampled at four scales / directions / speeds (no visible tiling).
vec2 detailSlope(vec2 p, float t, float dist) {
  const mat2 R1 = mat2(0.8, 0.6, -0.6, 0.8);
  const mat2 R2 = mat2(-0.38, 0.92, -0.92, -0.38);
  const mat2 R3 = mat2(0.26, -0.97, 0.97, 0.26);
  vec2 s = waveTex(p / 61.0 + vec2(t * 0.010, t * 0.006)) * 0.55;
  s += R1 * waveTex((R1 * p) / 23.0 + vec2(-t * 0.016, t * 0.012)) * 0.75;
  float near = 1.0 - smoothstep(60.0, 260.0, dist);
  s += R2 * waveTex((R2 * p) / 8.3 + vec2(t * 0.031, -t * 0.024)) * 0.6 * (0.35 + 0.65 * near);
  float nearer = 1.0 - smoothstep(35.0, 160.0, dist);
  s += R3 * waveTex((R3 * p) / 3.1 + vec2(-t * 0.05, -t * 0.043)) * 0.5 * nearer;
  float closest = 1.0 - smoothstep(10.0, 55.0, dist);
  s += R1 * R3 * waveTex((R2 * p) / 1.25 + vec2(t * 0.09, t * 0.07)) * 0.32 * closest;
  return s * uWaveSlope * uWind;
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

  // --- Depth from baked seabed ---
  vec2 duv = vWorldPos.xz / uTerrainSize + 0.5;
  float dEnc = texture2D(uDepthTex, duv).r;
  float depth = dEnc * dEnc * uMaxDepth;
  if (duv.x < 0.0 || duv.x > 1.0 || duv.y < 0.0 || duv.y > 1.0) depth = uMaxDepth;
  float calm = smoothstep(0.2, 3.0, depth); // waves flatten in very shallow water

  // --- Normal: swell + spectrum detail + simulation + rain ---
  vec2 slope;
  swell(vWorldPos.xz, uTime, slope);
  slope *= vSwellAmp;
  slope += detailSlope(vWorldPos.xz, uTime, dist) * (0.55 + 0.45 * calm);
  if (vSimMask > 0.0) {
    vec2 simN = texture2D(uSimTex, vSimUv).ba;
    slope -= simN * vSimMask * 1.4;
  }
  if (uRain > 0.01 && dist < 90.0) {
    vec2 rr = rainRipples(vWorldPos.xz * 2.2, uTime) + rainRipples(vWorldPos.xz * 1.6 + 7.3, uTime * 1.13);
    slope += rr * 0.35 * uRain * (1.0 - smoothstep(30.0, 90.0, dist));
  }
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));

  vec3 waterCol = mix(uShallow, uMid, smoothstep(0.4, 4.5, depth));
  waterCol = mix(waterCol, uDeep, smoothstep(4.5, 14.0, depth));
  float sunUp = clamp(uSunDir.y * 3.0, 0.0, 1.0);
  vec3 lightCol = uAmbient + uSunColor * sunUp * 0.6;
  // Subsurface-ish brightening on wave faces turned towards the viewer.
  float sss = pow(clamp(dot(V, -normalize(vec3(N.x, 0.25, N.z))), 0.0, 1.0), 3.0) * 0.25;
  // Facets tilted towards the sun / sky read lighter, giving visible fine ripples even from above.
  float facet = dot(N.xz, normalize(uSunDir.xz + vec2(0.35, 0.25))) * 2.4 * (1.0 - smoothstep(120.0, 500.0, dist));
  vec3 scatter = aces(waterCol * lightCol * (1.0 + sss) * clamp(1.0 + facet, 0.6, 1.4));

  // --- Refraction ---
  vec2 screenUv = gl_FragCoord.xy / uResolution;
  float refrStrength = 0.035 * clamp(depth / 2.0, 0.15, 1.0) / (1.0 + dist * 0.01);
  vec3 refr = texture2D(uRefrTex, clamp(screenUv + N.xz * refrStrength, 0.001, 0.999)).rgb;
  float viewDepth = depth / max(V.y, 0.12);
  float clarity = exp(-viewDepth * 0.22) * (1.0 - uRain * 0.35);
  vec3 below = mix(scatter, refr * mix(vec3(1.0), waterCol * 1.6 + 0.25, 0.35), clarity);

  // --- Reflection (distorted by the waves) ---
  vec4 rp = uReflMatrix * vec4(vWorldPos.x, 0.0, vWorldPos.z, 1.0);
  vec2 reflUv = rp.xy / rp.w * 0.5 + 0.5;
  reflUv += N.xz * (0.09 / (1.0 + dist * 0.0025));
  vec3 refl = texture2D(uReflTex, clamp(reflUv, 0.001, 0.999)).rgb;

  float cosT = clamp(dot(N, V), 0.0, 1.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  fresnel = clamp(fresnel, 0.0, 0.94);
  vec3 col = mix(below, refl, fresnel);

  // --- Sun glitter ---
  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(N, H), 0.0);
  float spec = pow(nh, 1400.0) * 9.0 + pow(nh, 160.0) * 0.45 + pow(nh, 24.0) * 0.04;
  col += aces(uSunColor * spec * sunUp * (1.0 - uRain * 0.85));

  // --- Shore foam ---
  float foamBand = smoothstep(0.9, 0.05, depth);
  float waveLines = sin(depth * 9.0 - uTime * 2.2 + vnoise(vWorldPos.xz * 0.4) * 4.0) * 0.5 + 0.5;
  float foamNoise = vnoise(vWorldPos.xz * 1.3 + uTime * 0.3) * vnoise(vWorldPos.xz * 0.5 - uTime * 0.2);
  float foam = foamBand * smoothstep(0.35, 0.85, waveLines * 0.6 + foamNoise * 0.9);
  foam = max(foam, smoothstep(0.25, 0.0, depth) * 0.8);
  // Whitecaps on the steepest wave crests offshore.
  float crest = smoothstep(0.32, 0.55, length(slope)) * smoothstep(3.0, 8.0, depth) * (1.0 - smoothstep(150.0, 400.0, dist));
  foam = max(foam, crest * (0.35 + uRain * 0.4) * vnoise(vWorldPos.xz * 0.8 + uTime * 0.5));
  col = mix(col, aces(lightCol * 1.05), clamp(foam, 0.0, 1.0) * 0.85);

  float alpha = smoothstep(0.0, 0.12, depth);
  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
  #include <encodings_fragment>
}
`;

/**
 * Tileable slope map baked from a sum of sinusoids with integer wave numbers (so it wraps
 * seamlessly), with a Phillips-like amplitude falloff and a dominant wind direction.
 */
function bakeWaveTexture(size = 256) {
  const rng = mulberry32(4242);
  const waves = [];
  const wind = [0.86, 0.5];
  for (let i = 0; i < 64; i++) {
    let kx, ky, k;
    do {
      kx = Math.round((rng() * 2 - 1) * 14);
      ky = Math.round((rng() * 2 - 1) * 14);
      k = Math.hypot(kx, ky);
    } while (k < 1);
    const align = Math.abs((kx * wind[0] + ky * wind[1]) / k);
    const amp = Math.pow(k, -1.6) * (0.25 + 0.75 * align * align) * (0.6 + rng() * 0.8);
    waves.push([kx, ky, amp, rng() * Math.PI * 2]);
  }
  const sx = new Float32Array(size * size), sy = new Float32Array(size * size);
  let maxS = 0;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = i / size, v = j / size;
      let dx = 0, dy = 0;
      for (const [kx, ky, a, ph] of waves) {
        const c = Math.cos(2 * Math.PI * (kx * u + ky * v) + ph) * a * 2 * Math.PI;
        dx += c * kx; dy += c * ky;
      }
      const k = j * size + i;
      sx[k] = dx; sy[k] = dy;
      maxS = Math.max(maxS, Math.abs(dx), Math.abs(dy));
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let k = 0; k < size * size; k++) {
    data[k * 4] = Math.round((sx[k] / maxS * 0.5 + 0.5) * 255);
    data[k * 4 + 1] = Math.round((sy[k] / maxS * 0.5 + 0.5) * 255);
    data[k * 4 + 2] = 128;
    data[k * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

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
      uWaveTex: { value: null },
      uReflMatrix: { value: this.reflMatrix }, uResolution: { value: new THREE.Vector2(1, 1) },
      uTerrainSize: { value: TERRAIN.size }, uMaxDepth: { value: WATER.maxDepth },
      uShallow: { value: new THREE.Vector3(...WATER.shallowColor) },
      uMid: { value: new THREE.Vector3(...WATER.midColor) },
      uDeep: { value: new THREE.Vector3(...WATER.deepColor) },
      uExposure: { value: 1 }, uSwell: { value: 1 }, uWaveSlope: { value: 0.32 }, uWind: { value: 1 },
    }]);
    this.uniforms.uWaveTex.value = bakeWaveTexture(256);
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
    this.cellSize = WATER.simSize / QUALITY.waterSegments;
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

  /** Dense grid around the origin of the mesh, coarse ring outside it (the mesh moves with the camera). */
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

  /** Keep the simulation window and the dense mesh around the camera focus. Call before adding drops. */
  follow(focus) {
    this.sim.follow(focus.x, focus.z);
    const b = this.simBounds;
    const cs = this.cellSize;
    this.mesh.position.set(Math.round((b.x + b.z / 2) / cs) * cs, 0, Math.round((b.y + b.w / 2) / cs) * cs);
  }

  update(dt) {
    this.sim.step(1);
    this.uniforms.uSimTex.value = this.sim.texture;
    this.ctx.uniforms.uSimTex.value = this.sim.texture;
    this.uniforms.uExposure.value = this.ctx.renderer.toneMappingExposure;
    const rain = this.ctx.uniforms.uRain.value;
    this.uniforms.uSwell.value = 1 + rain * 0.9;
    this.uniforms.uWind.value = 1 + rain * 0.35;
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
