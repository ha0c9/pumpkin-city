// Shared helpers: seeded randomness, noise, geometry merging, canvas textures.
const THREE = window.THREE;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}

export function fbm(x, y, octaves = 4, seed = 0) {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += valueNoise(x * f, y * f, seed + i * 17) * amp;
    norm += amp; amp *= 0.5; f *= 2.03;
  }
  return v / norm;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Merge several geometries into one non-indexed BufferGeometry with per-vertex colors.
 * parts: [{ geometry, color?: THREE.Color|number, matrix?: THREE.Matrix4 }]
 */
export function mergeColored(parts) {
  const positions = [], normals = [], colors = [];
  const tmpColor = new THREE.Color();
  for (const part of parts) {
    let g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    if (part.matrix) {
      g.applyMatrix4(part.matrix);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position, nor = g.attributes.normal;
    const col = g.attributes.color;
    tmpColor.set(part.color !== undefined ? part.color : 0xffffff);
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      if (col && part.color === undefined) colors.push(col.getX(i), col.getY(i), col.getZ(i));
      else colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

/** Merge geometries that share the same attribute layout (position/normal/uv), keeping UVs. */
export function mergeSimple(geometries) {
  const attrs = { position: [], normal: [], uv: [] };
  for (const src of geometries) {
    const g = src.index ? src.toNonIndexed() : src;
    for (const key of Object.keys(attrs)) {
      const a = g.attributes[key];
      if (!a) {
        const n = g.attributes.position.count * (key === 'uv' ? 2 : 3);
        for (let i = 0; i < n; i++) attrs[key].push(0);
        continue;
      }
      for (let i = 0; i < a.array.length; i++) attrs[key].push(a.array[i]);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(attrs.position, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(attrs.normal, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(attrs.uv, 2));
  out.computeBoundingSphere();
  return out;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function canvasTexture(canvas, { srgb = true, repeat, anisotropy = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = anisotropy;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** Render text onto a canvas texture, used for building signs and labels. */
export function textTexture(lines, {
  width = 1024, height = 256, bg = 'rgba(0,0,0,0)', color = '#ffffff',
  font = 'bold 96px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif',
  subFont = '600 52px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif',
  glow = null,
} = {}) {
  const c = makeCanvas(width, height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 18; }
  const arr = Array.isArray(lines) ? lines : [lines];
  const step = height / (arr.length + 1);
  arr.forEach((line, i) => {
    ctx.font = i === 0 ? font : subFont;
    ctx.fillText(line, width / 2, step * (i + 1));
  });
  return canvasTexture(c, { anisotropy: 8 });
}

/** Distance from point p to segment ab in 2D. */
export function distToSegment(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const wx = px - ax, wz = pz - az;
  const t = clamp((wx * vx + wz * vz) / (vx * vx + vz * vz || 1), 0, 1);
  const dx = px - (ax + vx * t), dz = pz - (az + vz * t);
  return Math.sqrt(dx * dx + dz * dz);
}

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _mid = new THREE.Vector3();
/** Matrix that maps a unit cylinder (height 1, radius 1, centered) onto the rod p1 -> p2. */
export function rodMatrix(p1, p2, radius, out = new THREE.Matrix4()) {
  _dir.subVectors(p2, p1);
  const len = _dir.length();
  _dir.divideScalar(len || 1);
  _q.setFromUnitVectors(_up, _dir);
  _mid.addVectors(p1, p2).multiplyScalar(0.5);
  _s.set(radius, len, radius);
  return out.compose(_mid, _q, _s);
}

/** Build an InstancedMesh from a list of matrices. */
export function instancedFrom(geometry, material, matrices, { castShadow = true, receiveShadow = true } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, matrices.length));
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.count = matrices.length;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => m.dispose());
    }
  });
}
