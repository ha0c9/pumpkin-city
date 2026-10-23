// Facade textures and materials shared by building modules.
import { makeCanvas, canvasTexture, mulberry32 } from '../core/Utils.js';
import { stoneTexture, brickTexture, concreteTexture, paverTexture } from '../core/Textures.js';

const THREE = window.THREE;

/**
 * Glass curtain wall: returns a MeshStandardMaterial with color, roughness and night-window emissive maps.
 * cols/rows = panels across one face / floors.
 */
export function curtainWallMaterial(ctx, { cols, rows, seed = 1, tint = [40, 70, 95], mullion = '#c9d0d6', litRatio = 0.35, repeatX = 1 }) {
  const pw = 32, ph = 48;
  const w = Math.min(2048, cols * pw), h = Math.min(2048, rows * ph);
  const cw = w / cols, chh = h / rows;
  const rng = mulberry32(seed);
  const color = makeCanvas(w, h), emis = makeCanvas(w, h), rough = makeCanvas(w, h);
  const c = color.getContext('2d'), e = emis.getContext('2d'), r = rough.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, w, h);
  r.fillStyle = 'rgb(0,30,0)'; r.fillRect(0, 0, w, h);
  for (let j = 0; j < rows; j++) {
    const floorLit = rng() < 0.85;
    for (let i = 0; i < cols; i++) {
      const v = (rng() - 0.5) * 14;
      const g = c.createLinearGradient(0, j * chh, 0, (j + 1) * chh);
      g.addColorStop(0, `rgb(${tint[0] + 14 + v},${tint[1] + 18 + v},${tint[2] + 22 + v})`);
      g.addColorStop(1, `rgb(${tint[0] + v},${tint[1] + v},${tint[2] + v})`);
      c.fillStyle = g;
      c.fillRect(i * cw, j * chh, cw, chh);
      if (floorLit && rng() < litRatio) {
        const warm = rng() < 0.7;
        const k = 0.55 + rng() * 0.45;
        e.fillStyle = warm ? `rgba(255,${Math.round(205 * k)},${Math.round(140 * k)},1)` : `rgba(${Math.round(210 * k)},${Math.round(230 * k)},255,1)`;
        e.fillRect(i * cw + 2, j * chh + chh * 0.22, cw - 4, chh * 0.74);
      }
    }
    // Spandrel band at the floor slab.
    c.fillStyle = `rgba(${tint[0] * 0.5},${tint[1] * 0.5},${tint[2] * 0.55},0.85)`;
    c.fillRect(0, j * chh, w, chh * 0.18);
    r.fillStyle = 'rgb(0,110,0)';
    r.fillRect(0, j * chh, w, chh * 0.18);
  }
  c.fillStyle = mullion; r.fillStyle = 'rgb(0,90,0)';
  for (let i = 0; i <= cols; i++) { c.fillRect(i * cw - 1.5, 0, 3, h); r.fillRect(i * cw - 1.5, 0, 3, h); }
  for (let j = 0; j <= rows; j++) { c.fillRect(0, j * chh - 1, w, 2); r.fillRect(0, j * chh - 1, w, 2); }

  const map = canvasTexture(color, { anisotropy: 8 });
  const emissiveMap = canvasTexture(emis, { anisotropy: 8 });
  const roughnessMap = canvasTexture(rough, { srgb: false, anisotropy: 8 });
  for (const t of [map, emissiveMap, roughnessMap]) {
    t.wrapS = THREE.RepeatWrapping; t.repeat.set(repeatX, 1);
  }
  const mat = new THREE.MeshStandardMaterial({
    map, roughnessMap, roughness: 1, metalness: 0.9,
    emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, envMapIntensity: 1.25,
  });
  ctx.nightMaterials.push({ material: mat, intensity: 1.15 });
  return mat;
}

/** Opaque wall with punched windows (school, offices). */
export function windowWallMaterial(ctx, { cols, rows, seed = 3, wall = 'brick', frame = '#f4f1ea', glass = '#3c5468', litRatio = 0.4, winW = 0.55, winH = 0.55 }) {
  const pw = 64, ph = 64;
  const w = Math.min(2048, cols * pw), h = Math.min(2048, rows * ph);
  const cw = w / cols, chh = h / rows;
  const rng = mulberry32(seed);
  const color = makeCanvas(w, h), emis = makeCanvas(w, h);
  const c = color.getContext('2d'), e = emis.getContext('2d');
  const base = (wall === 'brick' ? brickTexture() : wall === 'stone' ? stoneTexture() : concreteTexture()).image;
  for (let y = 0; y < h; y += base.height / 2) {
    for (let x = 0; x < w; x += base.width / 2) c.drawImage(base, x, y, base.width / 2, base.height / 2);
  }
  e.fillStyle = '#000'; e.fillRect(0, 0, w, h);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * cw + cw * (1 - winW) / 2, y = j * chh + chh * (1 - winH) / 2;
      const ww = cw * winW, hh = chh * winH;
      c.fillStyle = frame; c.fillRect(x - 3, y - 3, ww + 6, hh + 6);
      const g = c.createLinearGradient(x, y, x + ww, y + hh);
      g.addColorStop(0, glass); g.addColorStop(1, '#8fb3c9');
      c.fillStyle = g; c.fillRect(x, y, ww, hh);
      c.fillStyle = frame; c.fillRect(x + ww / 2 - 1.5, y, 3, hh); c.fillRect(x, y + hh * 0.35, ww, 3);
      if (rng() < litRatio) { e.fillStyle = 'rgb(255,226,170)'; e.fillRect(x, y, ww, hh); }
    }
  }
  const map = canvasTexture(color);
  const emissiveMap = canvasTexture(emis);
  const mat = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.75, metalness: 0.05 });
  ctx.nightMaterials.push({ material: mat, intensity: 0.9 });
  return mat;
}

const shared = new Map();
export function sharedMaterial(name) {
  if (shared.has(name)) return shared.get(name);
  let m;
  switch (name) {
    case 'stone': m = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.78 }); break;
    case 'stoneDark': m = new THREE.MeshStandardMaterial({ map: stoneTexture(), color: 0xb8ae9c, roughness: 0.8 }); break;
    case 'concrete': m = new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.85 }); break;
    case 'paving': m = new THREE.MeshStandardMaterial({ map: paverTexture(), roughness: 0.8, color: 0xe6e0d6 }); break;
    case 'steel': m = new THREE.MeshStandardMaterial({ color: 0xc8ced4, metalness: 0.95, roughness: 0.22 }); break;
    case 'darkSteel': m = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.85, roughness: 0.35 }); break;
    case 'roof': m = new THREE.MeshStandardMaterial({ color: 0x6d6f72, roughness: 0.9 }); break;
    case 'glassClear': m = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, metalness: 0.9, roughness: 0.04, transparent: true, opacity: 0.55, envMapIntensity: 1.4 }); break;
    case 'water': m = new THREE.MeshStandardMaterial({ color: 0x2b7f9e, metalness: 0.6, roughness: 0.05 }); break;
    case 'hedge': m = new THREE.MeshStandardMaterial({ color: 0x3f6e2a, roughness: 0.95 }); break;
    case 'white': m = new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.6 }); break;
    default: throw new Error(`Unknown shared material ${name}`);
  }
  shared.set(name, m);
  return m;
}

const colorCache = new Map();
/** Cached plain material, so modules that ask for the same look share one material (and merge into one draw call). */
export function colorMat(color, { roughness = 0.7, metalness = 0, emissive = null } = {}) {
  const key = `${color}|${roughness}|${metalness}|${emissive}`;
  if (!colorCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    if (emissive !== null) m.emissive = new THREE.Color(emissive);
    colorCache.set(key, m);
  }
  return colorCache.get(key);
}

/** Add a mesh with shadows to a group at a position. */
export function mesh(group, geometry, material, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = receive;
  group.add(m);
  return m;
}

/** Cylinder between two points (columns, rails, cables). */
export function rod(group, a, b, radius, material, sides = 8) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, sides), material);
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  group.add(m);
  return m;
}

/** Helper: add a box mesh to a group. */
export function box(group, w, h, d, x, y, z, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = receive;
  group.add(m);
  return m;
}

/** Box with UVs scaled to meters so tiling textures keep a constant density. */
export function tiledBox(group, w, h, d, x, y, z, material, scale = 0.25) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // Box faces: +x, -x, +y, -y, +z, -z (4 verts each).
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0] * scale, uv.getY(i) * dims[f][1] * scale);
    }
  }
  const m = new THREE.Mesh(g, material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  group.add(m);
  return m;
}
