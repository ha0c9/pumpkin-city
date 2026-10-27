// Water surface: GPU ripples + spectrum-based detail normals + planar reflection + screen-space
// refraction + depth-based color. The dense mesh follows the camera; the ripple simulation follows the focus.
import { WATER, WAVES, TERRAIN, QUALITY } from '../config/world.config.js';
import { RippleSimulation } from './RippleSimulation.js';
import { NOISE_GLSL } from './Terrain.js';
import { WaveSpectrum } from './WaveSpectrum.js';

const THREE = window.THREE;

// Fine patch half-extent in meters. The vertex shader's grid fade uses the same value.
const DETAIL_HALF = 400;

export const LAYER_DETAIL = 1; // grass & rain: skipped in reflection/refraction passes

const SWELL_GLSL = /* glsl */`
// Waves shorter than a few pixels (fp = meters per pixel, 0 in the vertex shader) fade out; sampled
// per pixel they alias into a regular diamond lattice far out at sea.
float waveKeep(float fp, float L) { return 1.0 - smoothstep(0.05, 0.2, fp / L); }

// Three long Gerstner-like swells; returns height and writes the slope.
float swell(vec2 p, float t, float fp, out vec2 slope) {
  float h = 0.0; slope = vec2(0.0);
  vec2 d[3]; float L[3]; float A[3];
  d[0] = normalize(vec2(0.8, 0.6)); L[0] = 38.0; A[0] = 0.16;
  d[1] = normalize(vec2(-0.3, 1.0)); L[1] = 23.0; A[1] = 0.09;
  d[2] = normalize(vec2(1.0, -0.45)); L[2] = 14.0; A[2] = 0.05;
  for (int i = 0; i < 3; i++) {
    float k = 6.28318 / L[i];
    float w = sqrt(9.8 * k);
    float ph = k * dot(d[i], p) - w * t;
    float a = A[i] * waveKeep(fp, L[i]);
    h += a * sin(ph);
    slope += d[i] * a * k * cos(ph);
  }
  return h;
}

// Typhoon sea: steep Gerstner waves running with the wind (+x). Returns (dx, height, dz) and the slope.
vec3 stormWaves(vec2 p, float t, float fp, out vec2 slope) {
  vec3 o = vec3(0.0); slope = vec2(0.0);
  vec2 d[4]; float L[4]; float A[4];
  d[0] = normalize(vec2(1.0, 0.25)); L[0] = 92.0; A[0] = 2.3;
  d[1] = normalize(vec2(0.85, -0.5)); L[1] = 56.0; A[1] = 1.3;
  d[2] = normalize(vec2(0.7, 0.7)); L[2] = 33.0; A[2] = 0.7;
  d[3] = normalize(vec2(1.0, -0.1)); L[3] = 19.0; A[3] = 0.34;
  for (int i = 0; i < 4; i++) {
    float k = 6.28318 / L[i];
    float w = sqrt(9.8 * k);
    float ph = k * dot(d[i], p) - w * t;
    float q = 0.8 / (k * A[i] * 4.0);
    o.xz += d[i] * q * A[i] * cos(ph);
    o.y += A[i] * sin(ph);
    slope += d[i] * A[i] * waveKeep(fp, L[i]) * k * cos(ph);
  }
  return o;
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
uniform float uStorm;
varying vec3 vWorldPos;
varying vec2 vBaseXZ;
varying vec2 vSimUv;
varying float vSimMask;
#include <fog_pars_vertex>
${SWELL_GLSL}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 suv = (wp.xz - uSimBounds.xy) / uSimBounds.zw;
  vec2 edgeUv = min(suv, 1.0 - suv);
  // Wide fade so the simulated patch never ends in a hard line.
  float mask = smoothstep(0.0, 0.22, min(edgeUv.x, edgeUv.y));
  vec2 duv = wp.xz / uTerrainSize + 0.5;
  float dEnc = (duv.x < 0.0 || duv.y < 0.0 || duv.x > 1.0 || duv.y > 1.0) ? 1.0 : texture2D(uDepthTex, duv).r;
  float depth = dEnc * dEnc * uMaxDepth;
  float amp = uSwell * smoothstep(0.3, 6.0, depth);
  // Vertex waves exist only near the camera. Past this they would meet the coarse skirt as a
  // square crease, and that crease jumps when the grid recenters (the flicker on pan / zoom).
  // The fragment shader evaluates the same swell everywhere, so the falloff stays radial.
  float camDist = distance(wp.xz, cameraPosition.xz);
  float dispFade = 1.0 - smoothstep(150.0, 360.0, camDist);
  float gridEdge = max(abs(position.x), abs(position.z)) / ${DETAIL_HALF.toFixed(1)};
  dispFade *= 1.0 - smoothstep(0.78, 0.96, gridEdge);
  float h = 0.0;
  if (mask > 0.0) h = texture2D(uSimTex, suv).r * mask * dispFade;
  vec2 sl;
  h += swell(wp.xz, uTime, 0.0, sl) * amp * dispFade;
  vBaseXZ = wp.xz;
  if (uStorm > 0.001) {
    float sAmp = uStorm * smoothstep(0.5, 8.0, depth);
    vec3 so = stormWaves(wp.xz, uTime, 0.0, sl);
    wp.xz += so.xz * sAmp * dispFade;
    h += so.y * sAmp * dispFade;
  }
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
uniform sampler2D uWaveTex;
uniform mat4 uReflMatrix;
uniform vec2 uResolution;
uniform float uTerrainSize;
uniform float uMaxDepth;
uniform float uTime;
uniform float uRain;
uniform float uStorm;
uniform float uSwell;
uniform float uDaylight;
uniform float uExposure;
uniform float uWaveSlope;
uniform float uWind;
uniform vec2 uWaveTiles;   // meters covered by the chop (RG) and ripple (BA) tiles
uniform vec2 uWaveDecode;  // texel [-1, 1] -> slope, per tile
uniform vec2 uWaveVar;     // mean squared slope of each tile
uniform float uMicroRough; // unresolved capillary roughness (mean squared slope)
uniform float uSpecular;
uniform vec2 uReflDistort; // horizontal / vertical reflection offset per unit slope (screen uv)
uniform vec3 uAbsorb;      // Beer-Lambert absorption per meter (red is absorbed first)
uniform vec3 uShallow;
uniform vec3 uMid;
uniform vec3 uDeep;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
varying vec3 vWorldPos;
varying vec2 vBaseXZ;
varying vec2 vSimUv;
varying float vSimMask;
#include <fog_pars_fragment>
${NOISE_GLSL}
${SWELL_GLSL}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Fraction of a log-uniform band [lmin, lmax] (meters) too short to resolve at this pixel footprint.
float unresolved(float footprint, float lmin, float lmax) {
  return clamp(log(6.0 * footprint / lmin) / log(lmax / lmin), 0.0, 1.0);
}

// Detail slopes from the animated spectrum texture. Each tile is read twice (second copy rotated and
// offset, gradient rotated back) to hide tiling. Bands that shrink below a few pixels fade out and
// their slope variance is returned in lostVar so the sun highlight can widen instead of aliasing.
vec2 detailSlope(vec2 p, float footprint, out float lostVar) {
  const mat2 R1 = mat2(0.8, 0.6, -0.6, 0.8);
  const mat2 R2 = mat2(-0.38, 0.92, -0.92, -0.38);
  float lostA = unresolved(footprint, uWaveTiles.x / 30.0, uWaveTiles.x / 3.0);
  float lostB = unresolved(footprint, uWaveTiles.y / 30.0, uWaveTiles.y / 3.0);
  vec2 a = texture2D(uWaveTex, p / uWaveTiles.x).rg * 2.0 - 1.0;
  a += (texture2D(uWaveTex, (R1 * p) / (uWaveTiles.x * 0.79) + vec2(0.37, 0.61)).rg * 2.0 - 1.0) * R1;
  vec2 b = texture2D(uWaveTex, (R2 * p) / uWaveTiles.y).ba * 2.0 - 1.0;
  b += (texture2D(uWaveTex, (R1 * R2 * p) / (uWaveTiles.y * 0.73) + vec2(0.71, 0.13)).ba * 2.0 - 1.0) * (R1 * R2);
  float keepA = 1.0 - smoothstep(0.35, 0.95, lostA);
  float keepB = 1.0 - smoothstep(0.35, 0.95, lostB);
  lostVar = uWaveVar.x * mix(lostA, 1.0, 1.0 - keepA) + uWaveVar.y * mix(lostB, 1.0, 1.0 - keepB);
  return (a * (uWaveDecode.x * keepA) + b * (uWaveDecode.y * keepB)) * 0.7071;
}

// Slope expressed along the camera's screen axes (x = right, y = away from the viewer).
vec2 viewSlope(vec3 N) {
  vec2 right = normalize(vec2(viewMatrix[0][0], viewMatrix[2][0]) + 1e-5);
  vec2 fwd = normalize(-vec2(viewMatrix[0][2], viewMatrix[2][2]) + 1e-5);
  return vec2(dot(N.xz, right), dot(N.xz, fwd));
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
  // Meters covered by this pixel on the water plane (grows with distance and grazing angle).
  float footprint = max(length(fwidth(vWorldPos.xz)), 1e-3);

  // --- Depth from baked seabed ---
  vec2 duv = vWorldPos.xz / uTerrainSize + 0.5;
  float dEnc = texture2D(uDepthTex, duv).r;
  float depth = dEnc * dEnc * uMaxDepth;
  if (duv.x < 0.0 || duv.x > 1.0 || duv.y < 0.0 || duv.y > 1.0) depth = uMaxDepth;
  float calm = smoothstep(0.2, 3.0, depth); // waves flatten in very shallow water

  // --- Normal: swell + spectrum detail + simulation + rain ---
  vec2 slope;
  swell(vWorldPos.xz, uTime, footprint, slope);
  // Per pixel, not the interpolated vertex amplitude: the outer skirt's triangles are
  // hundreds of meters wide and would otherwise shade a diagonal seam.
  slope *= uSwell * smoothstep(0.3, 6.0, depth);
  float stormAmp = uStorm * smoothstep(0.5, 8.0, depth);
  float stormH = 0.0;
  if (stormAmp > 0.001) {
    vec2 ss;
    vec3 so = stormWaves(vBaseXZ, uTime, footprint, ss);
    slope += ss * stormAmp;
    stormH = so.y * stormAmp;
  }
  float lostVar;
  float rough = uWaveSlope * uWind * (0.45 + 0.55 * calm);
  slope += detailSlope(vWorldPos.xz, footprint, lostVar) * rough;
  lostVar *= rough * rough;
  if (vSimMask > 0.0) {
    vec2 simN = texture2D(uSimTex, vSimUv).ba;
    slope -= simN * vSimMask * 1.4;
  }
  if (uRain > 0.01 && dist < 90.0) {
    vec2 rr = rainRipples(vWorldPos.xz * 2.2, uTime) + rainRipples(vWorldPos.xz * 1.6 + 7.3, uTime * 1.13);
    slope += rr * 0.35 * uRain * (1.0 - smoothstep(30.0, 90.0, dist));
  }
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));

  float sunUp = clamp(uSunDir.y * 3.0, 0.0, 1.0);
  vec3 lightCol = uAmbient + uSunColor * sunUp * 0.6;
  vec2 vs = viewSlope(N);

  // --- Water body: in-scattered color over the refracted seabed, attenuated per channel ---
  vec3 waterCol = mix(uShallow, uMid, smoothstep(0.6, 5.0, depth));
  waterCol = mix(waterCol, uDeep, smoothstep(5.0, 15.0, depth));
  waterCol = mix(waterCol, vec3(0.035, 0.1, 0.115), uStorm * 0.55);
  // Subsurface-ish brightening on wave faces turned towards the viewer.
  float sss = pow(clamp(dot(V, -normalize(vec3(N.x, 0.25, N.z))), 0.0, 1.0), 3.0) * 0.3;
  // Facets tilted towards the sun read slightly lighter, so ripples stay readable from above
  // where the Fresnel reflection is only ~2%.
  float facet = dot(N.xz, normalize(uSunDir.xz + vec2(0.35, 0.25))) * 1.3;
  vec3 inscatter = aces(waterCol * lightCol * (1.0 + sss) * clamp(1.0 + facet, 0.8, 1.25));

  vec2 screenUv = gl_FragCoord.xy / uResolution;
  float refrStrength = 0.06 * clamp(depth / 2.0, 0.1, 1.0) / (1.0 + dist * 0.01);
  vec3 refr = texture2D(uRefrTex, clamp(screenUv + vec2(vs.x, -vs.y) * refrStrength, 0.001, 0.999)).rgb;
  float path = depth * (1.0 + 1.0 / max(V.y, 0.15));
  // At night the stylized moon/hemi lighting would make the seabed glow turquoise through the shallows.
  vec3 transmit = exp(-uAbsorb * path) * (1.0 - uRain * 0.35) * mix(0.45, 1.0, uDaylight);
  // The depth map ends at the terrain border. A narrow cutoff there reads as a square line
  // across the bay; fade across a few hundred meters instead.
  vec2 edgeD = abs(duv - 0.5);
  transmit *= 1.0 - smoothstep(0.28, 0.62, max(edgeD.x, edgeD.y));
  vec3 below = mix(inscatter, refr, transmit);

  // --- Reflection (offset along the screen axes; the mirror texture is flipped horizontally) ---
  vec4 rp = uReflMatrix * vec4(vWorldPos.x, 0.0, vWorldPos.z, 1.0);
  vec2 reflUv = rp.xy / rp.w * 0.5 + 0.5;
  reflUv += vec2(-vs.x, vs.y) * uReflDistort / (1.0 + dist * 0.0015);
  vec3 refl = texture2D(uReflTex, clamp(reflUv, 0.001, 0.999)).rgb;

  float cosT = clamp(dot(N, V), 0.0, 1.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  vec3 col = mix(below, refl, fresnel);

  // --- Sun glitter: normalized Blinn-Phong whose width follows the unresolved slope variance ---
  // Sharp sparkles near the camera, a smooth glitter path towards the horizon.
  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(N, H), 0.0);
  float m2 = uMicroRough + lostVar;
  float shininess = clamp(2.0 / m2 - 2.0, 8.0, 4000.0);
  float fSun = 0.02 + 0.98 * pow(1.0 - clamp(dot(V, H), 0.0, 1.0), 5.0);
  float spec = (shininess + 2.0) * 0.159 * pow(nh, shininess) * fSun;
  col += aces(uSunColor * spec * uSpecular * sunUp * (1.0 - uRain * 0.85));

  // --- Shore foam ---
  float foamBand = smoothstep(0.9 + uStorm * 4.5, 0.05, depth);
  float waveLines = sin(depth * (9.0 - uStorm * 6.0) - uTime * (2.2 + uStorm * 1.8) + vnoise(vWorldPos.xz * 0.4) * 4.0) * 0.5 + 0.5;
  float foamNoise = vnoise(vWorldPos.xz * 1.3 + uTime * 0.3) * vnoise(vWorldPos.xz * 0.5 - uTime * 0.2);
  float foam = foamBand * smoothstep(0.35, 0.85, waveLines * 0.6 + foamNoise * 0.9);
  foam = max(foam, smoothstep(0.25, 0.0, depth) * 0.8);
  // Whitecaps on the steepest wave crests offshore.
  float sigma = sqrt(uWaveVar.x + uWaveVar.y) * rough;
  float crest = smoothstep(2.3 * sigma, 3.4 * sigma, length(slope)) * smoothstep(3.0, 8.0, depth) * (1.0 - smoothstep(150.0, 400.0, dist));
  foam = max(foam, crest * (0.35 + uRain * 0.4) * vnoise(vWorldPos.xz * 0.8 + uTime * 0.5));
  if (uStorm > 0.001) {
    // Breaking crests and wind-blown foam streaks.
    float breakers = smoothstep(1.5, 3.2, stormH) * vnoise(vWorldPos.xz * 0.35 + uTime * 0.8);
    vec2 sp = vec2(dot(vBaseXZ, vec2(0.97, 0.24)) * 0.05 - uTime * 0.35, dot(vBaseXZ, vec2(-0.24, 0.97)) * 0.7);
    float streaks = smoothstep(0.62, 0.85, vnoise(sp) * 0.7 + vnoise(sp * 2.3 + 4.1) * 0.4);
    foam = max(foam, uStorm * smoothstep(3.0, 8.0, depth) * (breakers * 1.4 + streaks * 0.6));
  }
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
      uWaveTex: { value: null },
      uReflMatrix: { value: this.reflMatrix }, uResolution: { value: new THREE.Vector2(1, 1) },
      uTerrainSize: { value: TERRAIN.size }, uMaxDepth: { value: WATER.maxDepth },
      uShallow: { value: new THREE.Vector3(...WATER.shallowColor) },
      uMid: { value: new THREE.Vector3(...WATER.midColor) },
      uDeep: { value: new THREE.Vector3(...WATER.deepColor) },
      uExposure: { value: 1 }, uSwell: { value: 1 }, uStorm: { value: 0 }, uWaveSlope: { value: WAVES.slope }, uWind: { value: 1 },
      uWaveTiles: { value: new THREE.Vector2(WAVES.tileA, WAVES.tileB) },
      uWaveDecode: { value: new THREE.Vector2() },
      uWaveVar: { value: new THREE.Vector2(WAVES.slopeVarA, WAVES.slopeVarB) },
      uMicroRough: { value: WAVES.microRough }, uSpecular: { value: WAVES.specular },
      uReflDistort: { value: new THREE.Vector2(...WAVES.reflDistort) },
      uAbsorb: { value: new THREE.Vector3(...WAVES.absorb) },
    }]);
    this.spectrum = new WaveSpectrum(renderer, {
      size: QUALITY.waveTexSize, count: WAVES.count, tileA: WAVES.tileA, tileB: WAVES.tileB,
      varA: WAVES.slopeVarA, varB: WAVES.slopeVarB, wind: WAVES.windAngle,
    });
    this.uniforms.uWaveTex.value = this.spectrum.texture;
    this.uniforms.uWaveDecode.value.set(1 / this.spectrum.enc.x, 1 / this.spectrum.enc.y);
    // UniformsUtils.merge clones textures; render-target textures must be the original objects.
    this.uniforms.uReflTex.value = this.reflRT.texture;
    this.uniforms.uRefrTex.value = this.refrRT.texture;
    this.uniforms.uDepthTex.value = terrain.depthTexture;
    // Same for the reflection matrix: renderPasses() writes into this.reflMatrix every frame.
    this.uniforms.uReflMatrix.value = this.reflMatrix;
    // Share live uniforms with the rest of the world.
    this.uniforms.uTime = u.uTime;
    this.uniforms.uRain = u.uRain;
    this.uniforms.uStorm = u.uStorm;
    this.uniforms.uDaylight = u.uDaylight;
    this.uniforms.uSunDir = u.uSunDir;
    this.uniforms.uSunColor = u.uSunColor;
    this.uniforms.uAmbient = u.uAmbient;
    this.uniforms.uSimBounds = u.uSimBounds;

    this.material = new THREE.ShaderMaterial({
      vertexShader: WATER_VS, fragmentShader: WATER_FS, uniforms: this.uniforms,
      fog: true, transparent: true, toneMapped: false,
      extensions: { derivatives: true },
    });
    this.detailHalf = DETAIL_HALF;
    this.cellSize = (this.detailHalf * 2) / QUALITY.waterSegments;
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

  /**
   * Fine grid around the mesh origin (the mesh is snapped to the camera) and a flat skirt
   * out to the map edge. Vertex waves fade out before the skirt, so the join stays flat.
   */
  _buildGeometry() {
    const inner = new THREE.PlaneGeometry(this.detailHalf * 2, this.detailHalf * 2, QUALITY.waterSegments, QUALITY.waterSegments);
    inner.rotateX(-Math.PI / 2);
    const parts = [inner];
    const S = WATER.size, s = this.detailHalf * 2;
    const band = (S - s) / 2;
    const add = (w, d, x, z) => {
      const g = new THREE.PlaneGeometry(w, d, 8, 8); g.rotateX(-Math.PI / 2); g.translate(x, 0, z); parts.push(g);
    };
    add(S, band, 0, -(s / 2 + band / 2));
    add(S, band, 0, s / 2 + band / 2);
    add(band, s, -(s / 2 + band / 2), 0);
    add(band, s, s / 2 + band / 2, 0);
    const chunks = [];
    let total = 0;
    for (const p of parts) {
      const ni = p.toNonIndexed();
      chunks.push(ni.attributes.position.array);
      total += ni.attributes.position.array.length;
      ni.dispose();
      if (ni !== p) p.dispose();
    }
    const positions = new Float32Array(total);
    let offset = 0;
    for (const a of chunks) { positions.set(a, offset); offset += a.length; }
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

  /** Slide the ripple window with the focus and keep the dense mesh under the camera. Call before adding drops. */
  follow(focus, camera) {
    this.sim.follow(focus.x, focus.z);
    const cs = this.cellSize;
    const p = camera ? camera.position : focus;
    // Snap to the vertex lattice so swell samples stay on the same world points as the camera moves.
    this.mesh.position.set(Math.round(p.x / cs) * cs, 0, Math.round(p.z / cs) * cs);
  }

  update(dt) {
    this.spectrum.update(this.ctx.uniforms.uTime.value);
    this.sim.step(1);
    this.uniforms.uSimTex.value = this.sim.texture;
    this.ctx.uniforms.uSimTex.value = this.sim.texture;
    this.uniforms.uExposure.value = this.ctx.renderer.toneMappingExposure;
    const rain = this.ctx.uniforms.uRain.value;
    this.uniforms.uSwell.value = 1 + rain * 0.9;
    this.uniforms.uWind.value = 1 + rain * 0.35 + this.ctx.uniforms.uStorm.value * 1.3;
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
