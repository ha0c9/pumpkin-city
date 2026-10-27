// Animated detail-wave slopes baked on the GPU into tileable RGBA8 textures.
// Two tiles with different physical sizes: chop (tens of meters .. ~2 m) and ripples (~3 m .. ~0.3 m).
// Ripples are rebaked every frame. Chop is rebaked a few times a second and advanced by its
// stored time derivative, which matches a full bake on the frames it runs.
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

// z is slope/length, precomputed on the CPU (same value the old inversesqrt produced).
// Tile A also writes d(slope)/dt in BA so the water shader can advance it between bakes.
const bakeFS = (n, derivative) => /* glsl */`
precision highp float;
#define N ${n}
uniform vec4 uWaves[N];
uniform float uOmega[N];
uniform float uEnc;
uniform float uDerivScale; // enc / maxOmega, so a full-scale slope rate fits the 8-bit range
varying vec2 vUv;
void main() {
  vec2 slope = vec2(0.0);
  vec2 deriv = vec2(0.0);
  for (int i = 0; i < N; i++) {
    vec4 w = uWaves[i];
    float ang = 6.2831853 * dot(w.xy, vUv) + w.w;
    vec2 dir = w.xy * w.z;
    slope += dir * cos(ang);
    ${derivative ? 'deriv += dir * (sin(ang) * uOmega[i]);' : ''}
  }
  vec2 es = clamp(slope * uEnc, -1.0, 1.0);
  ${derivative
    ? 'gl_FragColor = vec4(es, clamp(deriv * uDerivScale, -1.0, 1.0)) * 0.5 + 0.5;'
    : 'gl_FragColor = vec4(es * 0.5 + 0.5, 0.5, 0.5);'}
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
    this.maxOmegaA = this.wavesA.reduce((m, w) => Math.max(m, w.omega), 0.5);
    // (ω dt)^2 / 2 ≤ 0.03 on the fastest chop wave: below one step of the 8-bit slope texture
    // once forty-odd waves are summed. Ripples (tile B) stay on every display frame.
    this.intervalA = Math.sqrt(0.06) / this.maxOmegaA;
    this.lastA = -1;
    this.age = 0;
    this.bakedA = false;

    const rtOpts = {
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false,
      wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
      magFilter: THREE.LinearFilter, minFilter: THREE.LinearMipmapLinearFilter,
      generateMipmaps: true, anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    };
    this.rtA = new THREE.WebGLRenderTarget(size, size, rtOpts);
    this.rtB = new THREE.WebGLRenderTarget(size, size, rtOpts);
    const vec4s = (ws) => ws.map((w) => new THREE.Vector4(w.nx, w.ny, w.slope / (Math.hypot(w.nx, w.ny) || 1), w.phase));
    const omegas = (ws) => ws.map((w) => w.omega);
    this.matA = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: bakeFS(count, true), depthTest: false, depthWrite: false,
      uniforms: {
        uWaves: { value: vec4s(this.wavesA) }, uOmega: { value: omegas(this.wavesA) },
        uEnc: { value: this.enc.x }, uDerivScale: { value: this.enc.x / this.maxOmegaA },
      },
    });
    this.matB = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: bakeFS(count, false), depthTest: false, depthWrite: false,
      uniforms: {
        uWaves: { value: vec4s(this.wavesB) }, uOmega: { value: omegas(this.wavesB) },
        uEnc: { value: this.enc.y }, uDerivScale: { value: 1 },
      },
    });
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.matB);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.lastInfo = { calls: 0, tris: 0 };
  }

  /** Advance phases and re-bake. Tile A is reused for a few dozen milliseconds; tile B every frame. */
  update(t) {
    const setPhase = (ws, us) => {
      for (let i = 0; i < ws.length; i++) us[i].w = (ws[i].phase - ws[i].omega * t) % TWO_PI;
    };
    let calls = 0, tris = 0;
    const note = () => {
      calls += this.renderer.info.render.calls;
      tris += this.renderer.info.render.triangles;
    };
    setPhase(this.wavesB, this.matB.uniforms.uWaves.value);
    this._render(this.matB, this.rtB);
    note();
    const due = this.lastA < 0 || t < this.lastA || (t - this.lastA) >= this.intervalA;
    this.bakedA = due;
    if (due) {
      setPhase(this.wavesA, this.matA.uniforms.uWaves.value);
      this._render(this.matA, this.rtA);
      note();
      this.lastA = t;
    }
    this.age = (t - this.lastA) * this.maxOmegaA;
    this.lastInfo = { calls, tris };
  }

  _render(material, target) {
    this.quad.material = material;
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevXr = r.xr.enabled;
    r.xr.enabled = false;
    r.setRenderTarget(target);
    r.render(this.scene, this.camera);
    r.setRenderTarget(prevTarget);
    r.xr.enabled = prevXr;
  }
}
