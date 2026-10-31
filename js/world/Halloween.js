// Seasonal trim along the front of each building.
// To take it down in one commit: delete this file and the addHalloween() call in City.js.
import { makeCanvas, canvasTexture, mergeSimple } from '../core/Utils.js';

const THREE = window.THREE;
const SKIP = new Set(['schoolAheadSign', 'pocketPark', 'cornerGarden']);

function pumpkinGeometry() {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const y = t * 1.12;
    const r = 0.06 + Math.sin(t * Math.PI) * 0.58;
    pts.push(new THREE.Vector2(r, y));
  }
  const geo = new THREE.LatheGeometry(pts, 9);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const ridge = 0.9 + 0.1 * Math.cos(Math.atan2(z, x) * 7);
    p.setX(i, x * ridge);
    p.setZ(i, z * ridge);
  }
  geo.computeVertexNormals();
  return geo;
}

function flagGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.22, 0);
  shape.lineTo(0.22, 0);
  shape.lineTo(0, -0.36);
  return new THREE.ShapeGeometry(shape);
}

function hayMaterial() {
  const c = makeCanvas(64, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#a56b2e';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(74, 42, 16, 0.7)';
  g.lineWidth = 2;
  for (let y = 3; y < 64; y += 6) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(64, y + 1.5);
    g.stroke();
  }
  return new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.96 });
}

function hash(id) {
  let h = 2166136261;
  const s = String(id || '');
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

function frontBox(obj) {
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  const bb = new THREE.Box3();
  const tmp = new THREE.Box3();
  const size = new THREE.Vector3();
  let any = false;
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
    tmp.getSize(size);
    // Ground pads would push the trim out to the lot edge, away from the door.
    if (size.y < 0.5 && tmp.max.y < 1.2 && size.x > 5 && size.z > 5) return;
    if (!any) bb.copy(tmp);
    else bb.union(tmp);
    any = true;
  });
  return any ? bb : null;
}

function addMesh(parent, geo, mat, x, y, z, rotY, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
}

function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && o.geometry && !Array.isArray(o.material) && !o.material.transparent) meshes.push(o);
  });
  for (const o of meshes) {
    if (!groups.has(o.material.uuid)) groups.set(o.material.uuid, []);
    groups.get(o.material.uuid).push(o);
  }
  for (const items of groups.values()) {
    if (items.length < 2) continue;
    const geos = items.map((o) => {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      return g;
    });
    const merged = new THREE.Mesh(mergeSimple(geos), items[0].material);
    merged.castShadow = true;
    merged.receiveShadow = true;
    root.add(merged);
    for (const o of items) {
      if (o.parent) o.parent.remove(o);
      o.geometry = null;
    }
    geos.forEach((g) => g.dispose());
  }
}

export function addHalloween(city) {
  const root = new THREE.Group();
  root.name = 'halloween';
  city.group.add(root);

  // Unlit orange. The noon sun is strong enough to wash a lit orange out to pale yellow.
  const orange = new THREE.MeshBasicMaterial({ color: 0xe25a08 });
  const orangeDeep = new THREE.MeshBasicMaterial({ color: 0xc44706 });
  const stemMat = new THREE.MeshBasicMaterial({ color: 0x3c8a38 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffb020 });
  const soot = new THREE.MeshBasicMaterial({ color: 0x1a120e });
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.9 });
  const flagOrange = new THREE.MeshBasicMaterial({ color: 0xf06a00, side: THREE.DoubleSide });
  const flagBlack = new THREE.MeshBasicMaterial({ color: 0x1c1614, side: THREE.DoubleSide });
  const stone = new THREE.MeshBasicMaterial({ color: 0x8a8680 });
  const hay = hayMaterial();

  const pumpkinGeo = pumpkinGeometry();
  const stemGeo = new THREE.CylinderGeometry(0.045, 0.08, 0.26, 5);
  const eyeGeo = new THREE.BoxGeometry(0.16, 0.16, 0.05);
  const mouthGeo = new THREE.BoxGeometry(0.4, 0.13, 0.05);
  const postGeo = new THREE.BoxGeometry(0.08, 1, 0.08);
  const ropeGeo = new THREE.BoxGeometry(1, 0.035, 0.035);
  const flagGeo = flagGeometry();
  const hayGeo = new THREE.BoxGeometry(1, 0.42, 0.62);
  const stoneGeo = new THREE.BoxGeometry(0.46, 0.72, 0.12);
  const stoneCap = new THREE.SphereGeometry(0.2, 8, 6);

  const v = new THREE.Vector3();
  const spots = [];
  const put = (geo, mat, obj, lx, ly, lz, yaw, sx = 1, sy = 1, sz = 1) => {
    v.set(lx, 0, lz);
    obj.localToWorld(v);
    v.y = city.terrain.heightAt(v.x, v.z) + ly;
    addMesh(root, geo, mat, v.x, v.y, v.z, obj.rotation.y + yaw, sx, sy, sz);
  };

  for (const b of city.buildings) {
    if (SKIP.has(b.spec.type)) continue;
    const obj = b.object;
    const bb = frontBox(obj);
    if (!bb) continue;
    const width = bb.max.x - bb.min.x;
    if (width < 2) continue;
    const k = Math.min(1.2, Math.max(0.7, width / 24));
    const cx = (bb.min.x + bb.max.x) * 0.5;
    const front = bb.max.z + 0.55;
    const h = hash(b.spec.id || b.spec.type);
    const side = h < 0.5 ? -1 : 1;
    const shift = side * Math.min(width * 0.22, 7.5);
    const cluster = cx + shift;

    const span = Math.min(8.4, Math.max(3.1, width * 0.3));
    const postH = 2.15 * k;
    put(postGeo, wood, obj, cx - span / 2, postH / 2, front, 0, 1, postH, 1);
    put(postGeo, wood, obj, cx + span / 2, postH / 2, front, 0, 1, postH, 1);
    put(ropeGeo, wood, obj, cx, postH, front, 0, span, 1, 1);
    const flags = Math.max(4, Math.round(span / 0.72));
    for (let i = 0; i < flags; i++) {
      const x = cx - span / 2 + span * ((i + 0.5) / flags);
      put(flagGeo, i % 2 ? flagBlack : flagOrange, obj, x, postH - 0.02, front + 0.02, 0, k, k, 1);
    }

    const dressPile = (atX, count) => {
      const pile = [
        [0, 0.15, 1.05, orange, 0.12],
        [-0.95, 0.28, 0.78, orangeDeep, -0.18],
        [0.82, 0.02, 0.64, orange, 0.22],
      ];
      for (let i = 0; i < count; i++) {
        const [dx, dz, s0, mat, yaw] = pile[i];
        const s = s0 * k;
        const lx = atX + dx * k;
        const lz = front + 0.45 + dz * k;
        put(pumpkinGeo, mat, obj, lx, 0, lz, yaw, s, s * 0.8, s);
        put(stemGeo, stemMat, obj, lx, 1.12 * s * 0.8 + 0.1 * s, lz, yaw, s, s, s);
        const faceZ = lz + 0.54 * s;
        const faceY = 0.58 * s;
        const eyeX = 0.17 * s;
        put(eyeGeo, soot, obj, lx - eyeX, faceY, faceZ - 0.04, yaw, s * 1.45, s * 1.45, 1);
        put(eyeGeo, soot, obj, lx + eyeX, faceY, faceZ - 0.04, yaw, s * 1.45, s * 1.45, 1);
        put(mouthGeo, soot, obj, lx, faceY - 0.24 * s, faceZ - 0.04, yaw, s * 1.22, s * 1.55, 1);
        put(eyeGeo, glow, obj, lx - eyeX, faceY, faceZ, yaw, s * 1.05, s * 1.05, 1);
        put(eyeGeo, glow, obj, lx + eyeX, faceY, faceZ, yaw, s * 1.05, s * 1.05, 1);
        put(mouthGeo, glow, obj, lx, faceY - 0.24 * s, faceZ, yaw, s, s, 1);
      }
    };
    dressPile(cluster, h > 0.72 ? 2 : 3);
    if (width > 30) dressPile(cx - shift, 2);
    put(hayGeo, hay, obj, cluster - side * 1.35 * k, 0.21 * k, front + 0.2, 0.35, k, k, k);

    if (b.spec.type === 'ghostMuseum') {
      put(stoneGeo, stone, obj, cluster + side * 2.4, 0.36, front + 0.2, 0.2, 1, 1, 1);
      put(stoneCap, stone, obj, cluster + side * 2.4, 0.78, front + 0.2, 0, 1, 0.7, 1);
      put(stoneGeo, stone, obj, cluster + side * 3.15, 0.28, front - 0.15, -0.15, 0.72, 0.8, 0.72);
    }

    v.set(cluster, 0, front);
    obj.localToWorld(v);
    spots.push({ id: b.spec.id || b.spec.type, x: v.x, y: city.terrain.heightAt(v.x, v.z), z: v.z });
  }

  mergeByMaterial(root);
  city.halloweenSpots = spots;
  const night = city.ctx.uniforms.uNight;
  city.ctx.animators.push((t) => {
    const flick = 0.82 + Math.sin(t * 6.2) * 0.12 + Math.sin(t * 14.3) * 0.06;
    const hot = 0.75 + night.value * 0.25;
    glow.color.setRGB(1, (0.55 + hot * 0.2) * flick, 0.08 * flick);
  });
}
