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

    const type = this.supported === 'float' ? THREE.FloatType : THREE.HalfFloatType;
    const opts = {
      type, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    };
    this.rtA = new THREE.WebGLRenderTarget(resolution, resolution, opts);
    this.rtB = new THREE.WebGLRenderTarget(resolution, resolution, opts);

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

    const prevColor = new THREE.Color();
    renderer.getClearColor(prevColor);
    const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    for (const rt of [this.rtA, this.rtB]) { renderer.setRenderTarget(rt); renderer.clear(); }
    renderer.setRenderTarget(null);
    renderer.setClearColor(prevColor, prevAlpha);
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

  get texture() { return this.rtA.texture; }

  /**
   * Keep the simulated window centered near (x, z). Moves in whole-texel steps once the focus
   * drifts more than a quarter of the window, shifting the existing waves along.
   */
  follow(x, z) {
    const b = this.bounds;
    const cx = b.x + b.z / 2, cz = b.y + b.w / 2;
    if (Math.abs(x - cx) < b.z / 4 && Math.abs(z - cz) < b.w / 4) return false;
    const texel = b.z / this.res;
    const dx = Math.round((x - cx) / texel) * texel, dz = Math.round((z - cz) / texel) * texel;
    b.x += dx; b.y += dz;
    this.pendingShift = [dx / b.z, dz / b.w];
    return true;
  }

  /** Queue a drop at world (x, z). radius in meters, strength in meters of displacement. */
  addDrop(x, z, radius = 2, strength = 0.4) {
    const u = (x - this.bounds.x) / this.bounds.z;
    const v = (z - this.bounds.y) / this.bounds.w;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    if (this.queue.length > 256) return;
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
    if (!this.supported) return;
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
    r.setRenderTarget(prevTarget);
    r.autoClear = prevAutoClear;
    r.xr.enabled = prevXr;
  }
}
