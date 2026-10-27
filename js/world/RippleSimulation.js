// GPU height-field wave simulation (ping-pong render targets), after evanw/webgl-water.
// Texture channels: R = height (m), G = vertical velocity, B/A = surface normal x/z.
const THREE = window.THREE;

const MAX_DROPS = 16;

const QUAD_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DROP_FS = /* glsl */`
precision highp float;
#define MAX_DROPS ${MAX_DROPS}
uniform sampler2D uTex;
uniform vec4 uDrops[MAX_DROPS]; // xy = uv center, z = radius (uv), w = strength (m)
uniform int uCount;
varying vec2 vUv;
void main() {
  vec4 info = texture2D(uTex, vUv);
  for (int i = 0; i < MAX_DROPS; i++) {
    if (i >= uCount) break;
    vec4 d = uDrops[i];
    float k = max(0.0, 1.0 - length(d.xy - vUv) / d.z);
    k = 0.5 - cos(k * 3.14159265) * 0.5;
    info.r -= k * d.w;
  }
  gl_FragColor = info;
}
`;

// Copies the state shifted by uOffset (in uv) when the simulated window moves with the camera.
const SHIFT_FS = /* glsl */`
precision highp float;
uniform sampler2D uTex;
uniform vec2 uOffset;
varying vec2 vUv;
void main() {
  vec2 uv = vUv + uOffset;
  gl_FragColor = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture2D(uTex, uv);
}
`;

const UPDATE_FS = /* glsl */`
precision highp float;
uniform sampler2D uTex;
uniform sampler2D uLand;
uniform vec2 uDelta;
uniform vec4 uBounds;     // simulation area: minX, minZ, sizeX, sizeZ
uniform float uTerrainSize;
uniform float uDamping;
uniform float uSpeed;
varying vec2 vUv;
void main() {
  vec4 info = texture2D(uTex, vUv);
  vec2 world = uBounds.xy + vUv * uBounds.zw;
  float land = texture2D(uLand, world / uTerrainSize + 0.5).g;
  float average = (
    texture2D(uTex, vUv - vec2(uDelta.x, 0.0)).r +
    texture2D(uTex, vUv - vec2(0.0, uDelta.y)).r +
    texture2D(uTex, vUv + vec2(uDelta.x, 0.0)).r +
    texture2D(uTex, vUv + vec2(0.0, uDelta.y)).r
  ) * 0.25;
  info.g += (average - info.r) * uSpeed;
  info.g *= uDamping;
  info.r += info.g;
  info.r *= 0.9995;
  // Fade towards the edges of the simulated region so waves never hit a hard border.
  vec2 edge = min(vUv, 1.0 - vUv);
  float border = smoothstep(0.0, 0.04, min(edge.x, edge.y));
  info.rg *= mix(0.9, 1.0, border);
  if (land > 0.5) info.rg = vec2(0.0);
  gl_FragColor = info;
}
`;

const NORMAL_FS = /* glsl */`
precision highp float;
uniform sampler2D uTex;
uniform vec2 uDelta;
uniform float uTexel; // meters per texel
varying vec2 vUv;
void main() {
  vec4 info = texture2D(uTex, vUv);
  vec3 dx = vec3(uTexel, texture2D(uTex, vec2(vUv.x + uDelta.x, vUv.y)).r - info.r, 0.0);
  vec3 dy = vec3(0.0, texture2D(uTex, vec2(vUv.x, vUv.y + uDelta.y)).r - info.r, uTexel);
  info.ba = normalize(cross(dy, dx)).xz;
  gl_FragColor = info;
}
`;

export class RippleSimulation {
  constructor(renderer, { resolution, bounds, landTexture, terrainSize }) {
    this.renderer = renderer;
    this.res = resolution;
    this.bounds = bounds; // THREE.Vector4(minX, minZ, sizeX, sizeZ)
    this.queue = [];
    this.supported = this._checkSupport();
    this.energy = 0;
    this._idle = 0;
    this.rtA = null;
    this.rtB = null;
    // Bound while the simulation is cold so the water shader always has a sampler.
    // A zero field is what a fully damped simulation looks like, so waking it does not pop.
    // Alpha must be 0. A flat simulation stores normal.xz in B,A as 0,0 — an opaque
    // byte texture would sample A as 1 and tilt every wave normal in the patch.
    this.zero = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
    this.zero.needsUpdate = true;
    this.zero.magFilter = THREE.NearestFilter;
    this.zero.minFilter = THREE.NearestFilter;
    this.zero.generateMipmaps = false;

    const delta = new THREE.Vector2(1 / resolution, 1 / resolution);
    this.dropMat = this._mat(DROP_FS, {
      uTex: { value: null },
      uDrops: { value: Array.from({ length: MAX_DROPS }, () => new THREE.Vector4()) },
      uCount: { value: 0 },
    });
    this.updateMat = this._mat(UPDATE_FS, {
      uTex: { value: null }, uLand: { value: landTexture }, uDelta: { value: delta },
      uBounds: { value: bounds }, uTerrainSize: { value: terrainSize }, uDamping: { value: 0.993 }, uSpeed: { value: 0.6 },
    });
    this.normalMat = this._mat(NORMAL_FS, {
      uTex: { value: null }, uDelta: { value: delta }, uTexel: { value: bounds.z / resolution },
    });
    this.shiftMat = this._mat(SHIFT_FS, { uTex: { value: null }, uOffset: { value: new THREE.Vector2() } });
    this.pendingShift = null;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.dropMat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  /** Allocate the ping-pong targets on the first splash. Half-float when the device can render it. */
  _ensure() {
    if (this.rtA || !this.supported) return;
    const type = this.supported === 'float' ? THREE.FloatType : THREE.HalfFloatType;
    const opts = {
      type, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    };
    this.rtA = new THREE.WebGLRenderTarget(this.res, this.res, opts);
    this.rtB = new THREE.WebGLRenderTarget(this.res, this.res, opts);
    const r = this.renderer;
    const prevColor = new THREE.Color();
    r.getClearColor(prevColor);
    const prevAlpha = r.getClearAlpha();
    const prev = r.getRenderTarget();
    r.setClearColor(0x000000, 0);
    for (const rt of [this.rtA, this.rtB]) { r.setRenderTarget(rt); r.clear(); }
    r.setRenderTarget(prev);
    r.setClearColor(prevColor, prevAlpha);
  }

  /** Free both targets once the field has gone flat. The next drop allocates them again. */
  release() {
    if (this.rtA) { this.rtA.dispose(); this.rtA = null; }
    if (this.rtB) { this.rtB.dispose(); this.rtB = null; }
    this.queue.length = 0;
    this.pendingShift = null;
    this.energy = 0;
    this._idle = 0;
  }

  _checkSupport() {
    const caps = this.renderer.capabilities;
    const ext = this.renderer.extensions;
    if (caps.isWebGL2) return ext.has('EXT_color_buffer_float') ? 'half' : null;
    if (ext.has('OES_texture_half_float') && ext.has('EXT_color_buffer_half_float')) return 'half';
    if (ext.has('OES_texture_float') && ext.has('WEBGL_color_buffer_float')) return 'float';
    return null;
  }

  _mat(fs, uniforms) {
    return new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
  }

  get texture() { return this.rtA ? this.rtA.texture : this.zero; }

  /**
   * Keep the simulated window centered near (x, z). Moves in whole-texel steps once the focus
   * drifts more than a few texels, shifting the existing waves along.
   */
  follow(x, z) {
    const b = this.bounds;
    const cx = b.x + b.z / 2, cz = b.y + b.w / 2;
    const texel = b.z / this.res;
    // A quarter-window jump dragged the dense-grid edge across the view. Shift as soon as the
    // focus clears a few texels so the patch tracks the camera instead of popping.
    if (Math.abs(x - cx) < texel * 4 && Math.abs(z - cz) < texel * 4) return false;
    const dx = Math.round((x - cx) / texel) * texel, dz = Math.round((z - cz) / texel) * texel;
    b.x += dx; b.y += dz;
    // A cold field is already zero, so sliding the window does not need a shift pass.
    if (this.rtA) this.pendingShift = [dx / b.z, dz / b.w];
    return true;
  }

  /** Queue a drop at world (x, z). radius in meters, strength in meters of displacement. */
  addDrop(x, z, radius = 2, strength = 0.4) {
    if (!this.supported) return;
    const u = (x - this.bounds.x) / this.bounds.z;
    const v = (z - this.bounds.y) / this.bounds.w;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    if (this.queue.length > 256) return;
    this._ensure();
    this.energy += Math.abs(strength);
    this._idle = 0;
    this.queue.push([u, v, radius / this.bounds.z, strength]);
  }

  _pass(material) {
    this.quad.material = material;
    material.uniforms.uTex.value = this.rtA.texture;
    this.renderer.setRenderTarget(this.rtB);
    this.renderer.render(this.scene, this.camera);
    const t = this.rtA; this.rtA = this.rtB; this.rtB = t;
  }

  step(iterations = 1) {
    if (!this.supported || !this.rtA) return;
    // Rain off and the height field gone: keep the 1×1 zero texture instead of two full targets.
    if (!this.pendingShift && !this.queue.length && this.energy < 2e-4) {
      this._idle++;
      if (this._idle > 45) this.release();
      return;
    }
    this._idle = 0;
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevAutoClear = r.autoClear;
    const prevXr = r.xr.enabled;
    r.xr.enabled = false;
    r.autoClear = false;
    if (this.pendingShift) {
      this.shiftMat.uniforms.uOffset.value.set(this.pendingShift[0], this.pendingShift[1]);
      this._pass(this.shiftMat);
      this.pendingShift = null;
    }
    while (this.queue.length) {
      const batch = this.queue.splice(0, MAX_DROPS);
      batch.forEach((d, i) => this.dropMat.uniforms.uDrops.value[i].set(d[0], d[1], d[2], d[3]));
      this.dropMat.uniforms.uCount.value = batch.length;
      this._pass(this.dropMat);
    }
    for (let i = 0; i < iterations; i++) this._pass(this.updateMat);
    this._pass(this.normalMat);
    // Decay slower than the shader (0.993 damping plus the 0.9995 height fade) so we never
    // drop the targets while a ripple is still visible.
    this.energy *= 0.996 ** iterations;
    r.setRenderTarget(prevTarget);
    r.autoClear = prevAutoClear;
    r.xr.enabled = prevXr;
  }
}
