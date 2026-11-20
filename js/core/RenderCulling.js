// One-time scene preparation that lets three.js skip work it cannot see, without changing the picture.
//
// Static instancing: r128 InstancedMesh switches frustum culling off (its bounds are the single source
// geometry at the origin), so every tree, rock and lamp on every island went through every pass,
// shadow map included. Wide meshes are split into spatial chunks and every static one gets the
// true bounds of its instances, so the main, reflection and shadow cameras can cull them.
//
// Water passes: the refraction pass is clipped to y < 0.8 and the reflection pass to y > -0.05.
// Objects that never reach below the waterline are kept off LAYER_UNDERWATER (refraction draws
// only that layer); objects entirely below it move from layer 0 to LAYER_SUBMERGED, which the
// main camera still renders and the mirror camera does not.
const THREE = window.THREE;

export const LAYER_UNDERWATER = 2;
export const LAYER_SUBMERGED = 3;
const REFR_CLIP = 0.8;
const REFL_CLIP = -0.05;

const _m = new THREE.Matrix4();
const _box = new THREE.Box3();
const _sphere = new THREE.Sphere();

/** Geometry that shares the source buffers (uploaded once) but carries its own bounding sphere. */
function proxyGeometry(base, sphere) {
  const g = new THREE.BufferGeometry();
  if (base.index) g.setIndex(base.index);
  for (const k in base.attributes) g.setAttribute(k, base.attributes[k]);
  for (const grp of base.groups) g.addGroup(grp.start, grp.count, grp.materialIndex);
  g.boundingSphere = sphere;
  g.userData.base = base;
  return g;
}

// Mesh.raycast tests the geometry sphere against each instance matrix, so swap the source sphere
// back in for the per-instance test and use the chunk sphere as an early out.
function raycastChunk(raycaster, intersects) {
  const g = this.geometry;
  const chunk = g.boundingSphere;
  _sphere.copy(chunk).applyMatrix4(this.matrixWorld);
  if (!raycaster.ray.intersectsSphere(_sphere)) return;
  const base = g.userData.base;
  if (!base.boundingSphere) base.computeBoundingSphere();
  g.boundingSphere = base.boundingSphere;
  THREE.InstancedMesh.prototype.raycast.call(this, raycaster, intersects);
  g.boundingSphere = chunk;
}

function instanceSpheres(mesh) {
  const base = mesh.geometry;
  if (!base.boundingSphere) base.computeBoundingSphere();
  const bs = base.boundingSphere;
  const out = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, _m);
    const c = bs.center.clone().applyMatrix4(_m);
    out.push({ i, c, r: bs.radius * _m.getMaxScaleOnAxis() });
  }
  return out;
}

function enclose(items) {
  const box = new THREE.Box3();
  for (const it of items) box.expandByPoint(it.c);
  const center = box.getCenter(new THREE.Vector3());
  let r = 0;
  for (const it of items) r = Math.max(r, center.distanceTo(it.c) + it.r);
  return new THREE.Sphere(center, r);
}

function isDynamic(o) {
  for (let p = o; p; p = p.parent) if (p.userData.dynamic) return true;
  return false;
}

/**
 * Split wide static InstancedMeshes into `cell`-meter chunks and give every static InstancedMesh
 * real bounds. `skip(o)` excludes subtrees that move every frame (traffic).
 */
export function chunkStaticInstances(scene, pickables, { cell = 240, skip = () => false } = {}) {
  scene.updateMatrixWorld(true);
  const found = [];
  scene.traverse((o) => {
    if (!o.isInstancedMesh || o.instanceMatrix.usage === THREE.DynamicDrawUsage || o.count < 1) return;
    if (skip(o) || isDynamic(o)) return;
    found.push(o);
  });
  let chunks = 0;
  for (const mesh of found) {
    const items = instanceSpheres(mesh);
    const all = enclose(items);
    const worldIsLocal = mesh.matrixWorld.equals(_m.identity());
    if (!worldIsLocal || all.radius < cell) {
      mesh.geometry = proxyGeometry(mesh.geometry, all);
      mesh.frustumCulled = true;
      mesh.raycast = raycastChunk;
      continue;
    }
    const buckets = new Map();
    for (const it of items) {
      const key = `${Math.floor(it.c.x / cell)},${Math.floor(it.c.z / cell)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(it);
    }
    const parent = mesh.parent;
    const parts = [];
    for (const list of buckets.values()) {
      const part = new THREE.InstancedMesh(proxyGeometry(mesh.geometry, enclose(list)), mesh.material, list.length);
      list.forEach((it, j) => {
        mesh.getMatrixAt(it.i, _m);
        part.setMatrixAt(j, _m);
        if (mesh.instanceColor) {
          if (!part.instanceColor) part.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
          for (let c = 0; c < 3; c++) part.instanceColor.array[j * 3 + c] = mesh.instanceColor.array[it.i * 3 + c];
        }
      });
      part.name = mesh.name;
      part.castShadow = mesh.castShadow;
      part.receiveShadow = mesh.receiveShadow;
      part.renderOrder = mesh.renderOrder;
      part.visible = mesh.visible;
      part.layers.mask = mesh.layers.mask;
      part.userData = mesh.userData;
      part.frustumCulled = true;
      part.raycast = raycastChunk;
      parent.add(part);
      parts.push(part);
    }
    parent.remove(mesh);
    const at = pickables.indexOf(mesh);
    if (at >= 0) pickables.splice(at, 1, ...parts);
    chunks += parts.length;
  }
  return chunks;
}

function lowestAndHighest(o) {
  const g = o.geometry;
  if (!g || !g.attributes || !g.attributes.position) return null;
  const base = g.userData.base || g;
  if (!base.boundingBox) base.computeBoundingBox();
  if (base.boundingBox.isEmpty()) return null;
  if (!o.isInstancedMesh) {
    _box.copy(base.boundingBox).applyMatrix4(o.matrixWorld);
    return [_box.min.y, _box.max.y];
  }
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < o.count; i++) {
    o.getMatrixAt(i, _m);
    _m.premultiply(o.matrixWorld);
    _box.copy(base.boundingBox).applyMatrix4(_m);
    lo = Math.min(lo, _box.min.y); hi = Math.max(hi, _box.max.y);
  }
  return [lo, hi];
}

/**
 * Tag drawables for the water passes. `skip` roots (moving subtrees) keep whatever layers they set
 * themselves; lights join LAYER_UNDERWATER so the refraction pass is lit exactly as before.
 */
export function tagWaterLayers(scene, skip = []) {
  scene.updateMatrixWorld(true);
  const skipped = new Set(skip.filter(Boolean));
  const visit = (o) => {
    if (skipped.has(o)) return;
    if (o.isLight) o.layers.enable(LAYER_UNDERWATER);
    if ((o.isMesh || o.isLine || o.isPoints) && (o.layers.mask & 1)) {
      const span = o.isInstancedMesh && o.instanceMatrix.usage === THREE.DynamicDrawUsage ? null : lowestAndHighest(o);
      if (!span || span[0] < REFR_CLIP) o.layers.enable(LAYER_UNDERWATER);
      if (span && span[1] < REFL_CLIP) { o.layers.disable(0); o.layers.enable(LAYER_SUBMERGED); }
    }
    for (const c of o.children) visit(c);
  };
  visit(scene);
}
