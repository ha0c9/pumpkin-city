// Shared helpers: seeded randomness, noise, geometry merging, canvas textures.
export { mulberry32, hashString, valueNoise, fbm, clamp, lerp, smoothstep, distToSegment } from './Noise.js';

const THREE = window.THREE;

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
