// Places landmark buildings and randomly assigned facilities on city lots.
import { LANDMARKS, LOTS, RANDOM_FACILITIES } from '../config/city.layout.js';
import { getBuildingType } from '../core/Registry.js';
import { mulberry32 } from '../core/Utils.js';
import '../buildings/index.js';

const THREE = window.THREE;

const DEFAULT_NAMES = {
  school: { name: '南瓜岛小学', nameEn: 'Pumpkin Island School', description: '三层教学楼、钟楼、200 米环形跑道与升旗台的社区小学。' },
  pocketPark: { name: '口袋公园', nameEn: 'Pocket Park', description: '喷泉、长椅与花坛组成的街区绿地，预留给未来建筑。' },
  cornerGarden: { name: '街角花园', nameEn: 'Corner Garden', description: '临街小花园，可在后续版本替换为新的设施。' },
};

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
    for (const pick of RANDOM_FACILITIES.picks) {
      for (let i = 0; i < pick.count && pools[pick.lot].length; i++) {
        const lot = pools[pick.lot].shift();
        this.place({ type: pick.type, id: `${pick.type}-${++counter}`, position: lot.position, rotation: lot.rotation }, rng);
      }
    }
    for (const lot of pools.large) this.place({ type: 'pocketPark', id: `park-${++counter}`, position: lot.position, rotation: lot.rotation }, rng);
    for (const lot of pools.small) this.place({ type: 'cornerGarden', id: `garden-${++counter}`, position: lot.position, rotation: lot.rotation }, rng);
  }

  /** Create a building from a spec ({ type, position: [x, z], rotation, ... }) and add it to the world. */
  place(spec, rng = Math.random) {
    const def = getBuildingType(spec.type);
    const obj = def.create(this.ctx, spec, rng);
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
      category: def.label,
      description: spec.description || extra.description || defaults.description || '',
      height,
      focus: [x, y + Math.min(height * 0.45, 40), z],
      radius: Math.max(height * 1.25, Math.max(fp[0], fp[1]) * 1.3, 30),
      landmark: !['pocketPark', 'cornerGarden'].includes(spec.type),
      featured: !!spec.name,
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
