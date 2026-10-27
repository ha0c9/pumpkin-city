// Instanced trees built from alpha-tested leaf cards (broadleaf, pine, palm), bushes and shore rocks.
import { QUALITY } from '../config/world.config.js';
import { makeCanvas, canvasTexture, mulberry32, fbm, smoothstep } from '../core/Utils.js';

const THREE = window.THREE;

/** Atlas: leaves (u 0-0.5, v 0.5-1), bark (u 0.5-1, v 0.5-1), palm frond (u 0-1, v 0-0.5). */
function foliageAtlas() {
  const S = 512;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  const rng = mulberry32(5);
  x.clearRect(0, 0, S, S);
  // Leaf cluster (top-left quadrant in canvas space = v 0.5..1).
  for (let i = 0; i < 170; i++) {
    const r = Math.sqrt(rng()) * 118;
    const a = rng() * Math.PI * 2;
    const px = 128 + Math.cos(a) * r, py = 128 + Math.sin(a) * r;
    const g = 120 + rng() * 80;
    x.fillStyle = `rgb(${Math.round(g * 0.42)},${Math.round(g)},${Math.round(g * 0.3)})`;
    x.save(); x.translate(px, py); x.rotate(rng() * Math.PI * 2);
    x.beginPath(); x.ellipse(0, 0, 5 + rng() * 6, 2.5 + rng() * 3, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(30,60,20,0.5)'; x.lineWidth = 0.8;
    x.beginPath(); x.moveTo(-6, 0); x.lineTo(6, 0); x.stroke();
    x.restore();
  }
  // Bark (top-right).
  for (let yy = 0; yy < 256; yy++) {
    for (let xx = 256; xx < 512; xx += 4) {
      const n = fbm(xx * 0.05, yy * 0.012, 3, 3) * 0.5 + 0.5;
      const v = 70 + n * 70;
      x.fillStyle = `rgb(${Math.round(v * 0.8)},${Math.round(v * 0.62)},${Math.round(v * 0.45)})`;
      x.fillRect(xx, yy, 4, 1);
    }
  }
  // Palm frond (bottom half): central rib + leaflets.
  x.strokeStyle = '#6c7a3a'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(8, 384); x.lineTo(504, 384); x.stroke();
  for (let i = 0; i < 46; i++) {
    const t = i / 46;
    const px = 16 + t * 480;
    const len = 110 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05));
    for (const side of [-1, 1]) {
      const g = 110 + rng() * 60;
      x.strokeStyle = `rgb(${Math.round(g * 0.5)},${Math.round(g)},${Math.round(g * 0.32)})`;
      x.lineWidth = 7;
      x.beginPath(); x.moveTo(px, 384); x.quadraticCurveTo(px + 20, 384 + side * len * 0.5, px + 34, 384 + side * len); x.stroke();
    }
  }
  const tex = canvasTexture(c, { anisotropy: 4 });
  tex.flipY = true;
  return tex;
}

const UV = {
  leaf: [0, 0.5, 0.5, 1],
  bark: [0.5, 0.5, 1, 1],
  frond: [0, 0, 1, 0.5],
};

class Builder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }
  quad(p0, p1, p2, p3, n, region, color, normals) {
    const base = this.pos.length / 3;
    const [u0, v0, u1, v1] = UV[region];
    const ps = [p0, p1, p2, p3];
    const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (let i = 0; i < 4; i++) {
      this.pos.push(ps[i].x, ps[i].y, ps[i].z);
      const nn = normals ? normals[i] : n;
      this.nor.push(nn.x, nn.y, nn.z);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(color.r, color.g, color.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  /** Tapered trunk segment from a to b. */
  trunk(a, b, r0, r1, color, sides = 7) {
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    const t1 = new THREE.Vector3(1, 0, 0);
    if (Math.abs(dir.x) > 0.9) t1.set(0, 0, 1);
    const side = new THREE.Vector3().crossVectors(dir, t1).normalize();
    const side2 = new THREE.Vector3().crossVectors(dir, side).normalize();
    for (let i = 0; i < sides; i++) {
      const a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2;
      const n0 = side.clone().multiplyScalar(Math.cos(a0)).addScaledVector(side2, Math.sin(a0));
      const n1 = side.clone().multiplyScalar(Math.cos(a1)).addScaledVector(side2, Math.sin(a1));
      const p0 = a.clone().addScaledVector(n0, r0), p1 = a.clone().addScaledVector(n1, r0);
      const p2 = b.clone().addScaledVector(n1, r1), p3 = b.clone().addScaledVector(n0, r1);
      this.quad(p0, p1, p2, p3, null, 'bark', color, [n0, n1, n1, n0]);
    }
  }
  /** Leaf card centered at c with spherical normal pointing away from crown center. */
  card(c, size, crown, color, rng, region = 'leaf') {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI));
    const ax = new THREE.Vector3(size / 2, 0, 0).applyQuaternion(q);
    const ay = new THREE.Vector3(0, size / 2, 0).applyQuaternion(q);
    const n = c.clone().sub(crown).normalize();
    n.y += 0.25; n.normalize();
    this.quad(
      c.clone().sub(ax).sub(ay), c.clone().add(ax).sub(ay), c.clone().add(ax).add(ay), c.clone().sub(ax).add(ay),
      n, region, color,
    );
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

function broadleaf(seed) {
  const rng = mulberry32(seed);
  const b = new Builder();
  const bark = new THREE.Color(0.75, 0.68, 0.6);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  b.trunk(V(0, -0.3, 0), V(0, 3.2, 0), 0.32, 0.2, bark);
  const crowns = [];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + rng();
    const end = V(Math.cos(a) * 1.6, 4.6 + rng() * 1.2, Math.sin(a) * 1.6);
    b.trunk(V(0, 2.8, 0), end, 0.14, 0.06, bark, 5);
    crowns.push(end);
  }
  crowns.push(V(0, 6.2, 0));
  const center = V(0, 5.2, 0);
  for (const cc of crowns) {
    for (let k = 0; k < 13; k++) {
      const p = cc.clone().add(V((rng() - 0.5) * 2.6, (rng() - 0.5) * 2.0, (rng() - 0.5) * 2.6));
      const depth = p.distanceTo(center) / 3.2;
      const shade = 0.55 + 0.5 * Math.min(1, depth) + (rng() - 0.5) * 0.15;
      b.card(p, 1.9 + rng() * 0.9, center, new THREE.Color(shade * 0.95, shade, shade * 0.9), rng);
    }
  }
  return b.geometry();
}

function pine(seed) {
  const rng = mulberry32(seed);
  const b = new Builder();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  b.trunk(V(0, -0.3, 0), V(0, 10.5, 0), 0.3, 0.06, new THREE.Color(0.7, 0.6, 0.5));
  const layers = 9;
  for (let l = 0; l < layers; l++) {
    const t = l / layers;
    const y = 2.2 + t * 8.3;
    const r = (1 - t) * 2.8 + 0.35;
    const n = Math.round(12 * (1 - t) + 4);
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + rng() * 0.5;
      const rr = r * (0.45 + rng() * 0.6);
      const p = V(Math.cos(a) * rr, y - rr * 0.25 + (rng() - 0.5) * 0.4, Math.sin(a) * rr);
      const shade = 0.42 + 0.35 * (rr / (r + 0.01)) + (rng() - 0.5) * 0.1;
      b.card(p, 1.5 + (1 - t) * 0.8, V(0, y + 0.6, 0), new THREE.Color(shade * 0.55, shade * 0.78, shade * 0.6), rng);
    }
  }
  return b.geometry();
}

function palm(seed) {
  const rng = mulberry32(seed);
  const b = new Builder();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pts = [];
  const lean = 0.8 + rng() * 1.2;
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    pts.push(V(lean * t * t, -0.3 + t * 8.2, 0));
  }
  for (let i = 0; i < 7; i++) b.trunk(pts[i], pts[i + 1], 0.28 - i * 0.015, 0.27 - (i + 1) * 0.015, new THREE.Color(0.85, 0.78, 0.68), 7);
  const top = pts[7];
  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const a = f / fronds * Math.PI * 2 + rng() * 0.3;
    const dir = V(Math.cos(a), 0, Math.sin(a));
    const len = 3.6 + rng() * 1.0;
    const segs = 5;
    let prev = top.clone();
    const side = V(-dir.z, 0, dir.x);
    for (let s = 1; s <= segs; s++) {
      const t = s / segs;
      const p = top.clone().addScaledVector(dir, len * t);
      p.y += 0.9 * t - 2.2 * t * t;
      const w0 = 0.9 * Math.sin(Math.PI * Math.min(1, (t - 1 / segs) * 1.1 + 0.08));
      const w1 = 0.9 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.02));
      const n = V(0, 1, 0);
      const u0 = (s - 1) / segs, u1 = s / segs;
      const base = b.pos.length / 3;
      const verts = [prev.clone().addScaledVector(side, -w0), p.clone().addScaledVector(side, -w1), p.clone().addScaledVector(side, w1), prev.clone().addScaledVector(side, w0)];
      const uvs = [[u0, 0], [u1, 0], [u1, 0.5], [u0, 0.5]];
      const col = new THREE.Color(0.95, 1, 0.9);
      verts.forEach((v, i) => { b.pos.push(v.x, v.y, v.z); b.nor.push(n.x, n.y, n.z); b.uv.push(uvs[i][0], uvs[i][1]); b.col.push(col.r, col.g, col.b); });
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      prev = p;
    }
  }
  return b.geometry();
}

function bush(seed) {
  const rng = mulberry32(seed);
  const b = new Builder();
  const center = new THREE.Vector3(0, 0.5, 0);
  for (let k = 0; k < 16; k++) {
    const p = new THREE.Vector3((rng() - 0.5) * 1.8, 0.3 + rng() * 0.9, (rng() - 0.5) * 1.8);
    const shade = 0.6 + rng() * 0.35;
    b.card(p, 1.1 + rng() * 0.5, center, new THREE.Color(shade * 0.9, shade, shade * 0.75), rng);
  }
  return b.geometry();
}

function makeMaterial(ctx, atlas, swayAmount) {
  const mat = new THREE.MeshStandardMaterial({
    map: atlas, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, metalness: 0,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = ctx.uniforms.uTime;
    shader.uniforms.uRain = ctx.uniforms.uRain;
    shader.uniforms.uStorm = ctx.uniforms.uStorm;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uRain; uniform float uStorm;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 ip = vec2(0.0);
        #endif
        float hgt = max(position.y - 1.0, 0.0);
        float wind = (1.0 + uRain * 1.5 + uStorm * 7.5) * ${swayAmount.toFixed(4)};
        float sway = sin(uTime * 1.1 + ip.x * 0.13 + ip.y * 0.11) * 0.6 + sin(uTime * 2.3 + ip.x * 0.3) * 0.25;
        transformed.x += sway * hgt * hgt * wind;
        transformed.z += sway * hgt * hgt * wind * 0.5;
        float gust = sin(uTime * 3.7 + ip.x * 0.05 - ip.y * 0.03) * 0.5 + 0.5;
        transformed.x += hgt * hgt * uStorm * (1.0 + gust * 0.8) * ${(swayAmount * 6).toFixed(4)};
        transformed += normal * sin(uTime * 6.0 + position.x * 3.0 + position.z * 2.0) * 0.03 * step(1.5, position.y) * (1.0 + uRain);`);
    // Keep the spherical crown normals on both faces of each card.
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
      'float faceDirection = 1.0;\nvec3 normal = normalize(vNormal);\nvec3 geometryNormal = normal;');
  };
  return mat;
}

export const TREE_INFO = {
  broadleaf: { name: '阔叶树', nameEn: 'Broadleaf Tree', category: '植被 Vegetation', description: '常见的城市与林地阔叶乔木，高约 7-9 米。' },
  pine: { name: '松树', nameEn: 'Pine Tree', category: '植被 Vegetation', description: '常绿针叶乔木，多生长在西岭岛的山坡上。' },
  palm: { name: '椰子树', nameEn: 'Palm Tree', category: '植被 Vegetation', description: '生长在沙滩附近的热带棕榈。' },
  bush: { name: '灌木丛', nameEn: 'Shrub', category: '植被 Vegetation', description: '低矮灌木，点缀在草地与林缘。' },
  rock: { name: '礁石', nameEn: 'Rock', category: '自然 Nature', description: '海岸边风化的岩石。' },
};

export class Trees {
  constructor(ctx, terrain, groundMap, mask, fixedSpots) {
    this.ctx = ctx;
    this.islands = terrain.islands;
    const atlas = foliageAtlas();
    const rng = mulberry32(2026);
    const placements = { broadleaf: [], pine: [], palm: [], bush: [], rock: [] };
    const total = QUALITY.treeCount;

    for (const s of fixedSpots) placements.broadleaf.push({ x: s.x, y: s.y - 0.3, z: s.z, s: 0.72 + rng() * 0.18 });

    // Natural placement: forests are clumped by low-frequency noise.
    const areas = terrain.islands.map((i) => (i.landBox[2] - i.landBox[0]) * (i.landBox[3] - i.landBox[1]));
    const areaSum = areas.reduce((a, b) => a + b, 0);
    const pickIsland = () => {
      let r = rng() * areaSum;
      for (let i = 0; i < areas.length; i++) { r -= areas[i]; if (r <= 0) return terrain.islands[i]; }
      return terrain.islands[0];
    };
    const inDowntown = (x, z) => x > -165 && x < 165 && z > -145 && z < 145;
    let attempts = 0;
    let placed = 0;
    while (placed < total && attempts < total * 30) {
      attempts++;
      const isl = pickIsland();
      const b = isl.landBox;
      const x = b[0] + rng() * (b[2] - b[0]), z = b[1] + rng() * (b[3] - b[1]);
      const h = groundMap.heightAt(x, z);
      if (h < 0.9) continue;
      if (!mask.isFree(x, z, 2.5) || mask.hit(x, z, 9, 'building') !== null) continue;
      const city = inDowntown(x, z);
      const forest = fbm(x / 60, z / 60, 3, 4) * 0.5 + 0.5;
      const coast = terrain.coastDistance(x, z);
      let type;
      if (h < 1.9 && coast > -16) {
        if (rng() > 0.35) continue;
        type = 'palm';
      } else if (h < 1.25) {
        continue;
      } else {
        const density = city ? 0.08 : smoothstep(0.35, 0.65, forest);
        if (rng() > density + 0.04) continue;
        const pineChance = isl.id === 'west' ? 0.65 : isl.id === 'north' ? 0.4 : h > 7 ? 0.6 : 0.15;
        type = rng() < pineChance ? 'pine' : 'broadleaf';
        if (rng() < 0.45) placements.bush.push({ x: x + (rng() - 0.5) * 6, y: h - 0.2, z: z + (rng() - 0.5) * 6, s: 0.7 + rng() * 0.7 });
      }
      placements[type].push({ x, y: h - 0.25, z, s: 0.75 + rng() * 0.55 });
      placed++;
    }
    // Shore rocks.
    for (let i = 0, tries = 0; i < 260 && tries < 40000; tries++) {
      const isl = pickIsland();
      const b = isl.landBox;
      const x = b[0] - 10 + rng() * (b[2] - b[0] + 20), z = b[1] - 10 + rng() * (b[3] - b[1] + 20);
      const h = terrain.heightAt(x, z);
      if (h > 0.9 || h < -0.6 || !mask.isFree(x, z, 2)) continue;
      placements.rock.push({ x, y: h - 0.2, z, s: 0.5 + rng() * 1.4 });
      i++;
    }

    this.meshes = [];
    const geos = { broadleaf: broadleaf(3), pine: pine(4), palm: palm(5), bush: bush(6) };
    const sway = { broadleaf: 0.006, pine: 0.004, palm: 0.012, bush: 0.02 };
    for (const type of ['broadleaf', 'pine', 'palm', 'bush']) {
      this._instanced(type, geos[type], makeMaterial(ctx, atlas, sway[type]), placements[type], rng, type !== 'bush');
    }
    const rockGeo = new THREE.IcosahedronGeometry(1, 1);
    const rp = rockGeo.attributes.position;
    for (let i = 0; i < rp.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(rp, i);
      v.multiplyScalar(1 + fbm(v.x * 2, v.z * 2 + v.y, 2, 9) * 0.35);
      v.y *= 0.6;
      rp.setXYZ(i, v.x, v.y, v.z);
    }
    rockGeo.computeVertexNormals();
    this._instanced('rock', rockGeo, new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.9, flatShading: true }), placements.rock, rng, true);
    this.placements = placements;
  }

  _instanced(type, geo, mat, list, rng, castShadow) {
    if (!list.length) return;
    // Draw the instances in the same random order as before, then split into spatial chunks.
    // InstancedMesh defaults to frustumCulled = false, so one mesh of every tree was transformed
    // in the main view, both water passes and the shadow map. A chunk carries a tight sphere
    // (plus a margin for wind sway) and is culled as a whole; the trees that remain draw with
    // the same matrices, colors and geometry.
    geo.computeBoundingSphere();
    const base = geo.boundingSphere;
    const reachOf = (scale) => (base.radius + base.center.length()) * scale + 12;
    const records = list.map((p) => {
      const rot = new THREE.Euler(type === 'rock' ? rng() : 0, rng() * Math.PI * 2, type === 'rock' ? rng() * 0.5 : 0);
      const sy = type === 'rock' ? p.s * (0.6 + rng() * 0.6) : p.s * (0.9 + rng() * 0.25);
      const v = 0.85 + rng() * 0.3;
      return {
        p, rot, sy,
        color: new THREE.Color(v * (0.95 + rng() * 0.1), v, v * (0.9 + rng() * 0.1)),
        reach: reachOf(Math.max(p.s, sy)),
      };
    });
    // One mesh per island. Far islands drop out of the view and the shadow map; an island
    // that is on screen draws the same instances as the old single mesh.
    const buckets = new Map();
    for (const rec of records) {
      let key = 'off';
      let best = Infinity;
      const { x, z } = rec.p;
      for (const isl of this.islands) {
        const d = (isl.x - x) * (isl.x - x) + (isl.z - z) * (isl.z - z);
        if (d < best) { best = d; key = isl.id; }
      }
      const arr = buckets.get(key);
      if (arr) arr.push(rec);
      else buckets.set(key, [rec]);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    const info = { ...TREE_INFO[type], id: `veg-${type}` };
    for (const [key, items] of buckets) {
      // Own geometry shell so each chunk can carry its own bounding sphere while sharing vertex data.
      const g = new THREE.BufferGeometry();
      for (const name of Object.keys(geo.attributes)) g.setAttribute(name, geo.getAttribute(name));
      if (geo.index) g.setIndex(geo.index);
      const mesh = new THREE.InstancedMesh(g, mat, items.length);
      mesh.frustumCulled = true;
      let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      items.forEach((rec, i) => {
        const p = rec.p;
        q.setFromEuler(rec.rot);
        m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, rec.sy, p.s));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, rec.color);
        const rad = rec.reach;
        minX = Math.min(minX, p.x - rad); maxX = Math.max(maxX, p.x + rad);
        minY = Math.min(minY, p.y - rad); maxY = Math.max(maxY, p.y + rad);
        minZ = Math.min(minZ, p.z - rad); maxZ = Math.max(maxZ, p.z + rad);
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
      const r = 0.5 * Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), r);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.name = `trees-${type}-${key}`;
      mesh.userData.pick = info;
      this.ctx.scene.add(mesh);
      this.ctx.pickables.push(mesh);
      this.meshes.push(mesh);
    }
  }
}
