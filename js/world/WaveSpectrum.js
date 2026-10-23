// Animated detail-wave slopes baked on the GPU every frame into one tileable RGBA8 texture.
// Two tiles with different physical sizes: RG = chop (tens of meters .. ~2 m), BA = ripples (~3 m .. ~0.3 m).
// Every wave uses integer wave numbers (seamless tiling) and the deep-water dispersion relation
// omega = sqrt(g k), so long waves travel faster than short ones instead of the whole sheet sliding.
import { mulberry32 } from '../core/Utils.js';

const THREE = window.THREE;
const G = 9.81;
const TWO_PI = Math.PI * 2;

const QUAD_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const bakeFS = (n) => /* glsl */`
precision highp float;
#define N ${n}
uniform vec4 uWavesA[N]; // xy = integer wave vector, z = slope amplitude (a * k), w = phase at current time
uniform vec4 uWavesB[N];
uniform vec2 uEnc;       // slope -> [-1, 1] encode factor per tile
varying vec2 vUv;
void main() {
  vec2 a = vec2(0.0), b = vec2(0.0);
  for (int i = 0; i < N; i++) {
    vec4 w = uWavesA[i];
    a += w.xy * (w.z * inversesqrt(dot(w.xy, w.xy)) * cos(6.2831853 * dot(w.xy, vUv) + w.w));
    w = uWavesB[i];
    b += w.xy * (w.z * inversesqrt(dot(w.xy, w.xy)) * cos(6.2831853 * dot(w.xy, vUv) + w.w));
  }
  gl_FragColor = vec4(clamp(a * uEnc.x, -1.0, 1.0), clamp(b * uEnc.y, -1.0, 1.0)) * 0.5 + 0.5;
}
`;

/**
 * Pick `count` waves for one tile: log-uniform wavelengths (a k^-3 height spectrum has equal slope
 * energy per octave, so every wave gets a similar slope), cos^2-ish spreading around the wind with a
 * few cross / opposing waves so the pattern never looks like parallel stripes.
 */
function makeTile(rng, { tile, count, nMin, nMax, wind, spread, slopeVar }) {
  const waves = [];
  const used = new Set();
  let guard = 0;
  while (waves.length < count && guard++ < count * 200) {
    const n = nMin * Math.pow(nMax / nMin, rng());
    let dir = (rng() * 2 - 1) * spread;
    let weight = Math.pow(Math.cos(dir * 0.5 * Math.PI / spread), 2) * 0.7 + 0.3;
    if (rng() < 0.18) { dir += Math.PI * (0.55 + rng() * 0.9); weight *= 0.45; }
    const th = wind + dir;
    const nx = Math.round(n * Math.cos(th)), ny = Math.round(n * Math.sin(th));
    const key = `${nx},${ny}`;
    if ((nx === 0 && ny === 0) || used.has(key) || used.has(`${-nx},${-ny}`)) continue;
    used.add(key);
    const k = TWO_PI * Math.hypot(nx, ny) / tile;
    waves.push({ nx, ny, slope: weight * (0.6 + rng() * 0.8), phase: rng() * TWO_PI, omega: Math.sqrt(G * k) });
  }
  // The shader loops over exactly `count` entries; pad with silent waves.
  while (waves.length < count) waves.push({ nx: 1, ny: 0, slope: 0, phase: 0, omega: 0 });
  // Each wave contributes slope^2 / 2 to the mean squared slope magnitude.
  const v = waves.reduce((s, w) => s + w.slope * w.slope / 2, 0);
  const f = v > 0 ? Math.sqrt(slopeVar / v) : 0;
  for (const w of waves) w.slope *= f;
  return waves;
}

export class WaveSpectrum {
  /**
   * @param renderer THREE.WebGLRenderer
   * @param opts.size texture resolution (power of two)
   * @param opts.count waves per tile
   * @param opts.tileA / opts.tileB tile sizes in meters
   * @param opts.varA / opts.varB mean squared slope (|slope|^2) of each tile
   */
  constructor(renderer, { size = 512, count = 48, tileA = 72, tileB = 9, varA = 0.016, varB = 0.010, wind = 0.53, seed = 4242 } = {}) {
    this.renderer = renderer;
    this.tileA = tileA;
    this.tileB = tileB;
    this.varA = varA;
    this.varB = varB;
    const rng = mulberry32(seed);
    this.wavesA = makeTile(rng, { tile: tileA, count, nMin: 3, nMax: 30, wind, spread: 1.1, slopeVar: varA });
    this.wavesB = makeTile(rng, { tile: tileB, count, nMin: 3, nMax: 30, wind: wind + 0.25, spread: 1.4, slopeVar: varB });
    // Encode +-3.5 sigma of one slope component into the 8-bit range.
    this.enc = new THREE.Vector2(1 / (3.5 * Math.sqrt(varA / 2)), 1 / (3.5 * Math.sqrt(varB / 2)));

    this.rt = new THREE.WebGLRenderTarget(size, size, {
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false,
      wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
      magFilter: THREE.LinearFilter, minFilter: THREE.LinearMipmapLinearFilter,
      generateMipmaps: true, anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    });
    const vec4s = (ws) => ws.map((w) => new THREE.Vector4(w.nx, w.ny, w.slope, w.phase));
    this.material = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: bakeFS(count), depthTest: false, depthWrite: false,
      uniforms: { uWavesA: { value: vec4s(this.wavesA) }, uWavesB: { value: vec4s(this.wavesB) }, uEnc: { value: this.enc } },
    });
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  get texture() { return this.rt.texture; }

  /** Advance every wave to time t (seconds) and re-bake the slope texture (+ mipmaps). */
  update(t) {
    const set = (ws, us) => {
      for (let i = 0; i < ws.length; i++) {
        const w = ws[i];
        us[i].w = (w.phase - w.omega * t) % TWO_PI;
      }
    };
    set(this.wavesA, this.material.uniforms.uWavesA.value);
    set(this.wavesB, this.material.uniforms.uWavesB.value);
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevXr = r.xr.enabled;
    r.xr.enabled = false;
    r.setRenderTarget(this.rt);
    r.render(this.scene, this.camera);
    r.setRenderTarget(prevTarget);
    r.xr.enabled = prevXr;
  }
}
