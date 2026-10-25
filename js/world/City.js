// Places landmark buildings and randomly assigned facilities on city lots.
import { LANDMARKS, LOTS, RANDOM_FACILITIES } from '../config/city.layout.js';
import { getBuildingType } from '../core/Registry.js';
import { mulberry32, mergeSimple } from '../core/Utils.js';
import '../buildings/index.js';

const THREE = window.THREE;

const DEFAULT_NAMES = {
  school: { name: '江苏路第二小学', nameEn: 'Jiangsu Road No.2 Primary School', description: '校门朝向江苏路，设有传达室。四层教学楼、钟楼、200 米环形跑道、足球场、篮球场与升旗台。' },
  pocketPark: { name: '城市公园', nameEn: 'City Park', description: '草坪、步道、喷泉、儿童游乐场与花坛组成的街区公园，预留给未来建筑。' },
  cornerGarden: { name: '街角花园', nameEn: 'Corner Garden', description: '临街小花园，可在后续版本替换为新的设施。' },
};
const MINOR_TYPES = ['pocketPark', 'cornerGarden', 'constructionSite', 'convenienceStore'];

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Merge a building's static, single-material, opaque meshes into one mesh per material (fewer draw calls).
 * Objects flagged `userData.dynamic` (and their subtrees) are left untouched so they can still animate.
 */
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  const visit = (o) => {
    if (o.userData.dynamic) return;
    for (const c of o.children.slice()) visit(c);
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.transparent || o.children.length) return;
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`;
    if (!groups.has(key)) groups.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, items: [] });
    groups.get(key).items.push(o);
  };
  visit(root);
  for (const grp of groups.values()) {
    if (grp.items.length < 2) continue;
    const geos = grp.items.map((o) => {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      return g;
    });
    const merged = new THREE.Mesh(mergeSimple(geos), grp.material);
    merged.castShadow = grp.cast; merged.receiveShadow = grp.receive;
    for (const o of grp.items) o.parent.remove(o);
    geos.forEach((g) => g.dispose());
    root.add(merged);
  }
}

export class City {
  constructor(ctx, terrain) {
    this.ctx = ctx;
    this.terrain = terrain;
    this.buildings = [];
    this.treeSpots = [];
    this.group = new THREE.Group();
    this.group.name = 'city';
    ctx.scene.add(this.group);

    const rng = mulberry32(RANDOM_FACILITIES.seed);
    for (const spec of LANDMARKS) this.place({ ...spec }, rng);

    const pools = { large: shuffle(LOTS.large, rng), small: shuffle(LOTS.small, rng) };
    let counter = 0;
    const fromLot = (type, lot) => ({ type, id: `${type}-${++counter}`, position: lot.position, rotation: lot.rotation, size: lot.size, footprint: lot.size });
    for (const pick of RANDOM_FACILITIES.picks) {
      for (let i = 0; i < pick.count && pools[pick.lot].length; i++) this.place(fromLot(pick.type, pools[pick.lot].shift()), rng);
    }
    for (const lot of pools.large) this.place(fromLot('pocketPark', lot), rng);
    for (const lot of pools.small) this.place({ ...fromLot('cornerGarden', lot), footprint: null }, rng);
  }

  /** Create a building from a spec ({ type, position: [x, z], rotation, size?, ... }) and add it to the world. */
  place(spec, rng = Math.random) {
    const def = getBuildingType(spec.type);
    const obj = def.create(this.ctx, spec, rng);
    mergeStatic(obj);
    const [x, z] = spec.position;
    const y = this.terrain.heightAt(x, z);
    const rot = spec.rotation || 0;
    obj.position.set(x, y, z);
    obj.rotation.y = rot;
    obj.name = spec.id || spec.type;

    const fp = spec.footprint || def.footprint;
    this.ctx.mask.addRect(x, z, fp[0], fp[1], rot, 'building');

    const height = obj.userData.height || 10;
    const defaults = DEFAULT_NAMES[spec.type] || {};
    const extra = def.info ? def.info(spec) : {};
    const info = {
      id: spec.id || spec.type,
      type: spec.type,
      name: spec.name || extra.name || defaults.name || def.label,
      nameEn: spec.nameEn || extra.nameEn || defaults.nameEn || '',
      category: extra.category || def.label,
      description: spec.description || extra.description || defaults.description || '',
      height,
      focus: [x, y + Math.min(height * 0.45, 40), z],
      radius: Math.max(height * 1.25, Math.max(fp[0], fp[1]) * 1.3, 30),
      landmark: !['pocketPark', 'cornerGarden'].includes(spec.type),
      featured: !!spec.name || !!extra.featured,
      minor: MINOR_TYPES.includes(spec.type) && !extra.featured,
    };
    obj.userData.pick = info;
    obj.traverse((o) => { o.userData.pick = info; });
    this.ctx.pickables.push(obj);
    if (obj.userData.animate) this.ctx.animators.push(obj.userData.animate);

    obj.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    for (const [lx, lz] of obj.userData.treeSpots || []) {
      v.set(lx, 0, lz).applyMatrix4(obj.matrixWorld);
      this.treeSpots.push({ x: v.x, y: this.terrain.heightAt(v.x, v.z) + 0.3, z: v.z });
    }
    this.group.add(obj);
    this.buildings.push({ spec, object: obj, info });
    return obj;
  }
}
