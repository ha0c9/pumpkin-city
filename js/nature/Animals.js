// Cartoon animals (flat color blocks, readable silhouettes). One shared material and geometry per
// shape. Only deer and swans cast shadows. userData.parts (legs, neck, wings, tail, feathers,
// claws, flippers, fluke) stays compatible with update / _animate.
import { ANIMALS } from '../config/city.layout.js';
import { mulberry32 } from '../core/Utils.js';

const THREE = window.THREE;

const INFO = {
  deer: { name: '梅花鹿', nameEn: 'Sika Deer', category: '动物 Animal', description: '白斑、大耳朵和短角，在林间草地上漫步吃草的卡通梅花鹿。' },
  rabbit: { name: '野兔', nameEn: 'Wild Rabbit', category: '动物 Animal', description: '长耳朵、白尾巴，在草地上蹦跳觅食的卡通野兔。' },
  duck: { name: '绿头鸭', nameEn: 'Mallard Duck', category: '动物 Animal', description: '绿头、黄嘴、白颈环，沿岸浅水区游弋的卡通绿头鸭，身后会留下水波。' },
  gull: { name: '海鸥', nameEn: 'Seagull', category: '动物 Animal', description: '白身、灰翅、黄喙，在海面与岛屿上空盘旋的卡通海鸥。' },
  squirrel: { name: '松鼠', nameEn: 'Red Squirrel', category: '动物 Animal', description: '红毛、大眼睛，拖着卷起的蓬松大尾巴在林间蹦跳的卡通松鼠。' },
  peacock: { name: '孔雀', nameEn: 'Peacock', category: '动物 Animal', description: '蓝颈、冠羽，停下来时把眼斑尾羽展开成扇形的卡通孔雀。' },
  crab: { name: '螃蟹', nameEn: 'Beach Crab', category: '动物 Animal', description: '圆壳、大钳子，在沙滩上横着走的卡通螃蟹。' },
  turtle: { name: '海龟', nameEn: 'Sea Turtle', category: '动物 Animal', description: '圆壳、宽鳍，在近岸浅水里慢慢划水的卡通海龟。' },
  swan: { name: '天鹅', nameEn: 'Swan', category: '动物 Animal', description: '白羽、橙喙、弯长颈，在水面上滑行的卡通天鹅。' },
  dolphin: { name: '海豚', nameEn: 'Dolphin', category: '动物 Animal', description: '灰背白肚、短吻微笑，成群在深水区跃出水面的卡通海豚。' },
};

const SWIMMERS = new Set(['duck', 'turtle', 'swan']);

// One material and one geometry per shape. Parts only differ by position, rotation and scale,
// so sharing them is the same picture with a few dozen buffers instead of one per animal.
const _mats = new Map();
const mat = (color, rough = 0.85) => {
  const key = `${color}|${rough}`;
  let m = _mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).convertSRGBToLinear(), roughness: rough });
    _mats.set(key, m);
  }
  return m;
};
const _geos = new Map();
function geoOnce(key, build) {
  let g = _geos.get(key);
  if (!g) { g = build(); _geos.set(key, g); }
  return g;
}
const sphere = (...a) => geoOnce(`s:${a.join(',')}`, () => new THREE.SphereGeometry(...a));
const boxGeo = (...a) => geoOnce(`b:${a.join(',')}`, () => new THREE.BoxGeometry(...a));
const cyl = (...a) => geoOnce(`c:${a.join(',')}`, () => new THREE.CylinderGeometry(...a));
const cone = (...a) => geoOnce(`k:${a.join(',')}`, () => new THREE.ConeGeometry(...a));

function part(geo, material, x, y, z, sx = 1, sy = 1, sz = 1, shadow = false) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = shadow;
  m.receiveShadow = false;
  return m;
}

/** Cartoon eyes. `s` scales the pair; they face +Z. */
function addEyes(parent, y, z, sep, s = 1) {
  const white = mat(0xf7f4ee), pupil = mat(0x1a120e);
  for (const side of [-1, 1]) {
    parent.add(part(sphere(1, 8, 6), white, side * sep, y, z, 0.045 * s, 0.052 * s, 0.03 * s));
    parent.add(part(sphere(1, 6, 4), pupil, side * sep, y + 0.004 * s, z + 0.02 * s, 0.02 * s, 0.026 * s, 0.016 * s));
  }
}

function makeDeer() {
  const g = new THREE.Group();
  const fur = mat(0xc47a3a), light = mat(0xf3e2c4), dark = mat(0x2a1c14), antler = mat(0xe6d2a8, 0.55);
  const body = sphere(1, 12, 8);
  const sh = true;
  g.add(part(body, fur, 0, 1.02, 0, 0.36, 0.3, 0.64, sh));
  g.add(part(body, light, 0, 0.86, 0.06, 0.26, 0.16, 0.44, sh));
  const spot = sphere(0.055, 5, 4);
  for (const [x, y, z] of [[-0.22, 1.18, 0.12], [0.22, 1.2, -0.02], [-0.14, 1.2, -0.26], [0.26, 1.12, 0.26], [0.02, 1.24, 0.08], [-0.28, 1.08, 0.3], [0.16, 1.16, -0.3], [-0.04, 1.16, 0.34]]) {
    g.add(part(spot, light, x, y, z));
  }
  const neck = new THREE.Group();
  neck.position.set(0, 1.2, 0.4);
  const neckMesh = part(cyl(0.1, 0.15, 0.52, 8), fur, 0, 0.2, 0.05, 1, 1, 1, sh);
  neckMesh.rotation.x = 0.42;
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.set(0, 0.48, 0.16);
  head.add(part(body, fur, 0, 0.04, 0.06, 0.17, 0.15, 0.2, sh));
  head.add(part(body, light, 0, -0.02, 0.16, 0.1, 0.08, 0.1));
  head.add(part(body, dark, 0, -0.01, 0.26, 0.05, 0.04, 0.045));
  addEyes(head, 0.08, 0.18, 0.075, 0.9);
  for (const s of [-1, 1]) {
    const ear = part(body, fur, s * 0.15, 0.12, 0, 0.045, 0.12, 0.03, sh);
    ear.rotation.z = s * -0.65;
    head.add(ear);
    const a = part(cyl(0.012, 0.02, 0.34, 5), antler, s * 0.05, 0.26, -0.02);
    a.rotation.z = s * -0.38;
    head.add(a);
    const b = part(cyl(0.01, 0.014, 0.16, 5), antler, s * 0.15, 0.36, 0.02);
    b.rotation.z = s * -1.15;
    head.add(b);
  }
  neck.add(head);
  g.add(neck);
  const legs = [];
  const legGeo = geoOnce('deer-leg', () => {
    const geo = new THREE.CylinderGeometry(0.042, 0.03, 0.78, 6);
    geo.translate(0, -0.39, 0);
    return geo;
  });
  for (const [x, z] of [[-0.16, 0.36], [0.16, 0.36], [-0.16, -0.36], [0.16, -0.36]]) {
    const leg = part(legGeo, fur, x, 0.82, z, 1, 1, 1, sh);
    g.add(leg);
    legs.push(leg);
  }
  g.add(part(body, light, 0, 1.12, -0.58, 0.08, 0.11, 0.06, sh));
  g.userData.parts = { legs, neck };
  return g;
}

function makeRabbit() {
  const g = new THREE.Group();
  const fur = mat(0xb08968), white = mat(0xf7f3ec), pink = mat(0xf0a0b0);
  const s = sphere(1, 10, 8);
  g.add(part(s, fur, 0, 0.22, 0, 0.17, 0.15, 0.22));
  g.add(part(s, white, 0, 0.16, 0.05, 0.12, 0.1, 0.14));
  g.add(part(s, fur, 0, 0.4, 0.16, 0.12, 0.11, 0.12));
  addEyes(g, 0.44, 0.26, 0.05, 0.75);
  g.add(part(s, pink, 0, 0.37, 0.28, 0.028, 0.02, 0.02));
  for (const x of [-0.05, 0.05]) {
    const ear = part(s, fur, x, 0.62, 0.12, 0.03, 0.18, 0.028);
    ear.rotation.x = -0.18;
    g.add(ear);
    const inner = part(s, pink, x, 0.62, 0.145, 0.015, 0.12, 0.012);
    inner.rotation.x = -0.18;
    g.add(inner);
  }
  g.add(part(s, white, 0, 0.26, -0.2, 0.075, 0.075, 0.05));
  return g;
}

function makeDuck() {
  const g = new THREE.Group();
  const s = sphere(1, 10, 8);
  const body = mat(0x8d5a32), chest = mat(0xe7d3ae), head = mat(0x1c7a48, 0.45);
  const bill = mat(0xf0a020, 0.45), ring = mat(0xf6f3ec);
  g.add(part(s, body, 0, 0.13, -0.02, 0.16, 0.12, 0.22));
  g.add(part(s, chest, 0, 0.15, 0.08, 0.13, 0.1, 0.12));
  g.add(part(s, head, 0, 0.32, 0.18, 0.095, 0.09, 0.1));
  g.add(part(s, ring, 0, 0.23, 0.14, 0.08, 0.022, 0.08));
  g.add(part(cone(0.04, 0.13, 6), bill, 0, 0.3, 0.3).rotateX(Math.PI / 2));
  addEyes(g, 0.35, 0.26, 0.042, 0.55);
  for (const x of [-0.06, 0.06]) g.add(part(boxGeo(0.07, 0.016, 0.09), bill, x, 0.02, 0.05));
  return g;
}

function makeGull() {
  const g = new THREE.Group();
  const s = sphere(1, 10, 8);
  const white = mat(0xf7f7f4, 0.55), grey = mat(0xb7c0c8, 0.55), yellow = mat(0xf2c230, 0.5), black = mat(0x22262b);
  g.add(part(s, white, 0, 0, 0, 0.14, 0.12, 0.32));
  g.add(part(s, white, 0, 0.06, 0.28, 0.11, 0.1, 0.12));
  g.add(part(cone(0.03, 0.16, 6), yellow, 0, 0.05, 0.44).rotateX(Math.PI / 2));
  addEyes(g, 0.1, 0.36, 0.045, 0.5);
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.08, 0.04, 0.02);
    const wg = geoOnce(side < 0 ? 'gull-wing-l' : 'gull-wing-r', () => {
      const geo = new THREE.BoxGeometry(0.72, 0.025, 0.22);
      geo.translate(side * 0.36, 0, 0);
      return geo;
    });
    const w = new THREE.Mesh(wg, grey);
    w.castShadow = false;
    pivot.add(w);
    const tip = new THREE.Mesh(boxGeo(0.22, 0.026, 0.14), black);
    tip.position.set(side * 0.68, 0, -0.02);
    tip.castShadow = false;
    pivot.add(tip);
    g.add(pivot);
    wings.push({ pivot, side });
  }
  g.add(part(boxGeo(0.12, 0.02, 0.16), white, 0, 0.02, -0.36));
  g.userData.parts = { wings };
  return g;
}

function makeSquirrel() {
  const g = new THREE.Group();
  const fur = mat(0xd2652e), belly = mat(0xf6e0c4), dark = mat(0x2a1810);
  const s = sphere(1, 10, 8);
  g.add(part(s, fur, 0, 0.16, 0, 0.1, 0.1, 0.15));
  g.add(part(s, belly, 0, 0.14, 0.04, 0.07, 0.07, 0.1));
  g.add(part(s, fur, 0, 0.3, 0.12, 0.085, 0.08, 0.085));
  addEyes(g, 0.33, 0.19, 0.038, 0.72);
  g.add(part(s, dark, 0, 0.29, 0.205, 0.02, 0.015, 0.016));
  for (const x of [-0.045, 0.045]) g.add(part(s, fur, x, 0.4, 0.1, 0.028, 0.045, 0.02));
  const tail = new THREE.Group();
  tail.position.set(0, 0.18, -0.12);
  tail.add(part(s, fur, 0, 0.08, -0.08, 0.08, 0.1, 0.08));
  tail.add(part(s, fur, 0, 0.24, -0.1, 0.1, 0.13, 0.09));
  tail.add(part(s, belly, 0, 0.38, -0.02, 0.075, 0.08, 0.065));
  g.add(tail);
  g.userData.parts = { tail };
  return g;
}

function makePeacock() {
  const g = new THREE.Group();
  const blue = mat(0x1a4fa8, 0.45), green = mat(0x1f7a52, 0.5), brown = mat(0x6b4a2a), beak = mat(0xf0a030, 0.5);
  const s = sphere(1, 10, 8);
  g.add(part(s, blue, 0, 0.62, 0.02, 0.18, 0.2, 0.28));
  g.add(part(s, brown, 0, 0.64, -0.08, 0.16, 0.1, 0.18));
  g.add(part(cyl(0.04, 0.06, 0.4, 8), blue, 0, 0.92, 0.18).rotateX(0.3));
  g.add(part(s, blue, 0, 1.14, 0.26, 0.07, 0.075, 0.08));
  g.add(part(cone(0.022, 0.08, 6), beak, 0, 1.12, 0.35).rotateX(Math.PI / 2));
  addEyes(g, 1.17, 0.32, 0.035, 0.45);
  for (let i = -1; i <= 1; i++) {
    const c = part(cyl(0.006, 0.006, 0.14, 4), blue, i * 0.025, 1.24, 0.24);
    c.rotation.z = i * 0.28;
    g.add(c);
    g.add(part(s, mat(0xf2c14d, 0.45), i * 0.04, 1.32, 0.24, 0.016, 0.016, 0.016));
  }
  for (const x of [-0.08, 0.08]) g.add(part(cyl(0.016, 0.012, 0.48, 5), beak, x, 0.24, 0.02));
  const tail = new THREE.Group();
  tail.position.set(0, 0.66, -0.22);
  const feathers = [];
  const featherGeo = sphere(1, 8, 5);
  const eyeGold = mat(0xd9a521, 0.4), eyeTeal = mat(0x14306e, 0.35);
  const N = 11;
  for (let i = 0; i < N; i++) {
    const f = new THREE.Group();
    const len = 0.95 + 0.28 * (1 - Math.abs(i - (N - 1) / 2) / ((N - 1) / 2));
    f.add(part(featherGeo, green, 0, 0, -len / 2, 0.075, 0.012, len / 2));
    f.add(part(featherGeo, eyeGold, 0, 0.008, -len + 0.12, 0.065, 0.014, 0.075));
    f.add(part(featherGeo, eyeTeal, 0, 0.014, -len + 0.12, 0.032, 0.012, 0.036));
    tail.add(f);
    feathers.push({ f, k: i / (N - 1) - 0.5 });
  }
  g.add(tail);
  g.userData.parts = { tail, feathers };
  return g;
}

function makeCrab() {
  const g = new THREE.Group();
  const shell = mat(0xe24b32, 0.55), dark = mat(0x1a100c), cream = mat(0xf2d2b0);
  const s = sphere(1, 10, 8);
  g.add(part(s, shell, 0, 0.09, 0, 0.16, 0.07, 0.12));
  g.add(part(s, cream, 0, 0.05, 0.02, 0.1, 0.03, 0.08));
  for (const x of [-0.05, 0.05]) {
    g.add(part(cyl(0.008, 0.008, 0.06, 5), shell, x, 0.16, 0.08));
    g.add(part(s, dark, x, 0.2, 0.09, 0.018, 0.018, 0.016));
  }
  const claws = [];
  for (const side of [-1, 1]) {
    const c = new THREE.Group();
    c.position.set(side * 0.12, 0.08, 0.06);
    c.add(part(cyl(0.02, 0.016, 0.08, 5), shell, side * 0.04, 0.02, 0.02).rotateZ(side * 0.8));
    c.add(part(s, shell, side * 0.07, 0.04, 0.08, 0.055, 0.04, 0.07));
    c.add(part(s, cream, side * 0.09, 0.05, 0.12, 0.02, 0.012, 0.035));
    g.add(c);
    claws.push(c);
  }
  const legs = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = part(cyl(0.01, 0.006, 0.16, 4), shell, side * 0.18, 0.05, -0.05 + i * 0.045);
      leg.rotation.z = side * 1.05;
      g.add(leg);
      legs.push(leg);
    }
  }
  g.userData.parts = { claws, legs };
  return g;
}

function makeTurtle() {
  const g = new THREE.Group();
  const shell = mat(0x6a7a3a, 0.55), scute = mat(0x3e4a28, 0.6), skin = mat(0x8faf62, 0.7);
  const dome = sphere(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  g.add(part(dome, shell, 0, 0.02, 0, 0.46, 0.2, 0.56));
  const ball = sphere(1, 8, 6);
  for (const [x, z] of [[0, 0.05], [-0.16, 0.12], [0.16, -0.08], [0, -0.18]]) {
    g.add(part(ball, scute, x, 0.12, z, 0.1, 0.06, 0.12));
  }
  g.add(part(ball, skin, 0, 0.02, 0, 0.4, 0.06, 0.5));
  g.add(part(ball, skin, 0, 0.06, 0.62, 0.13, 0.1, 0.15));
  addEyes(g, 0.1, 0.74, 0.05, 0.4);
  const flippers = [];
  for (const [x, z, front] of [[-0.4, 0.28, 1], [0.4, 0.28, 1], [-0.32, -0.4, 0], [0.32, -0.4, 0]]) {
    const f = part(ball, skin, x, 0.02, z, front ? 0.3 : 0.16, 0.03, front ? 0.12 : 0.09);
    flippers.push({ f, side: Math.sign(x), front });
    g.add(f);
  }
  g.userData.parts = { flippers };
  return g;
}

function makeSwan() {
  const g = new THREE.Group();
  const white = mat(0xf7f7f3, 0.55), orange = mat(0xf07828, 0.5), black = mat(0x1a1a1a);
  const s = sphere(1, 12, 10);
  const sh = true;
  g.add(part(s, white, 0, 0.16, 0, 0.26, 0.18, 0.46, sh));
  g.add(part(s, white, 0, 0.26, -0.16, 0.18, 0.1, 0.22, sh));
  const neckGeo = geoOnce('swan-neck', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.22, 0.28), new THREE.Vector3(0, 0.48, 0.42), new THREE.Vector3(0, 0.74, 0.3), new THREE.Vector3(0, 0.9, 0.4),
  ]), 12, 0.045, 7, false));
  g.add(part(neckGeo, white, 0, 0, 0, 1, 1, 1, sh));
  g.add(part(s, white, 0, 0.92, 0.42, 0.06, 0.055, 0.08, sh));
  g.add(part(s, black, 0, 0.9, 0.46, 0.035, 0.03, 0.03));
  g.add(part(cone(0.028, 0.14, 7), orange, 0, 0.9, 0.54).rotateX(Math.PI / 2));
  addEyes(g, 0.95, 0.48, 0.03, 0.4);
  return g;
}

function makeDolphin() {
  const g = new THREE.Group();
  const grey = mat(0x4a6d88, 0.4), belly = mat(0xf2f6f8, 0.45), dark = mat(0x243038);
  const s = sphere(1, 12, 10);
  g.add(part(s, grey, 0, 0.02, 0, 0.28, 0.26, 0.85));
  g.add(part(s, belly, 0, -0.06, 0.05, 0.2, 0.14, 0.7));
  g.add(part(s, grey, 0, 0.02, 0.95, 0.12, 0.1, 0.38));
  g.add(part(s, dark, 0, -0.02, 1.28, 0.06, 0.025, 0.08));
  addEyes(g, 0.08, 0.72, 0.12, 0.55);
  const fin = new THREE.Mesh(cone(0.2, 0.42, 4), grey);
  fin.position.set(0, 0.32, -0.05); fin.scale.set(0.22, 1, 0.7); fin.rotation.x = -0.4; fin.castShadow = false;
  g.add(fin);
  for (const side of [-1, 1]) {
    g.add(part(s, grey, side * 0.28, -0.08, 0.2, 0.2, 0.035, 0.1).rotateY(side * 0.45));
  }
  const fluke = new THREE.Group();
  fluke.position.set(0, 0, -0.85);
  fluke.add(part(s, grey, 0, 0, -0.16, 0.08, 0.07, 0.22));
  for (const side of [-1, 1]) fluke.add(part(s, grey, side * 0.18, 0, -0.32, 0.2, 0.03, 0.09).rotateY(side * 0.35));
  g.add(fluke);
  g.userData.parts = { fluke };
  return g;
}

export class Animals {
  constructor(ctx, terrain, groundMap, mask, water) {
    this.ctx = ctx;
    this.terrain = terrain;
    this.ground = groundMap;
    this.mask = mask;
    this.water = water;
    this.rng = mulberry32(99);
    this.list = [];
    this.group = new THREE.Group();
    this.group.name = 'animals';
    ctx.scene.add(this.group);
    for (const spec of ANIMALS) {
      for (let i = 0; i < spec.count; i++) this._spawn(spec);
    }
  }

  _islandFor(spec) {
    const id = spec.island || spec.near;
    return id ? this.terrain.islandById(id) : this.terrain.islands[Math.floor(this.rng() * this.terrain.islands.length)];
  }

  /** Grass point on the island; with `near`, stay within a short wander range so animals avoid crossing town. */
  _landPoint(isl, near = null) {
    const b = isl.landBox;
    for (let k = 0; k < 160; k++) {
      let x, z;
      if (near && k < 100) {
        const a = this.rng() * Math.PI * 2, r = 4 + this.rng() * 30;
        x = near.x + Math.cos(a) * r; z = near.z + Math.sin(a) * r;
      } else {
        x = b[0] + this.rng() * (b[2] - b[0]); z = b[1] + this.rng() * (b[3] - b[1]);
      }
      if (x > -170 && x < 170 && z > -150 && z < 150) continue;
      if (this.ground.grassAt(x, z) > 0.9 && this.mask.isFree(x, z, 3) && this.terrain.islandAt(x, z) === isl) {
        return new THREE.Vector3(x, 0, z);
      }
    }
    return near ? near.clone() : new THREE.Vector3(isl.x, 0, isl.z);
  }

  _waterPoint(isl, near = null) {
    const b = isl.landBox;
    for (let k = 0; k < 200; k++) {
      let x, z;
      if (near && k < 120) {
        const a = this.rng() * Math.PI * 2, r = 3 + this.rng() * 25;
        x = near.x + Math.cos(a) * r; z = near.z + Math.sin(a) * r;
      } else {
        x = b[0] - 30 + this.rng() * (b[2] - b[0] + 60); z = b[1] - 30 + this.rng() * (b[3] - b[1] + 60);
      }
      const h = this.terrain.heightAt(x, z);
      if (h < -0.4 && h > -4 && this.terrain.bridges?.heightAt(x, z) == null) return new THREE.Vector3(x, 0, z);
    }
    return near ? near.clone() : new THREE.Vector3(b[2] + 20, 0, isl.z);
  }

  /** Dry sand between the waterline and the grass. */
  _beachPoint(isl, near = null) {
    const b = isl.landBox;
    for (let k = 0; k < 400; k++) {
      let x, z;
      if (near && k < 150) {
        const a = this.rng() * Math.PI * 2, r = 2 + this.rng() * 12;
        x = near.x + Math.cos(a) * r; z = near.z + Math.sin(a) * r;
      } else {
        x = b[0] + this.rng() * (b[2] - b[0]); z = b[1] + this.rng() * (b[3] - b[1]);
      }
      const h = this.terrain.heightAt(x, z);
      if (h > 0.15 && h < 1.0 && this.mask.isFree(x, z, 1) && this.terrain.bridges?.heightAt(x, z) == null) return new THREE.Vector3(x, 0, z);
    }
    return near ? near.clone() : this._landPoint(isl);
  }

  /** Center of a circle of open deep water near the island for a dolphin pod. */
  _poolCenter(isl, radius) {
    const b = isl.landBox;
    for (let k = 0; k < 300; k++) {
      const x = b[0] - 160 + this.rng() * (b[2] - b[0] + 320), z = b[1] - 160 + this.rng() * (b[3] - b[1] + 320);
      let ok = this.terrain.heightAt(x, z) < -9;
      for (let i = 0; ok && i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        const px = x + Math.cos(a) * radius, pz = z + Math.sin(a) * radius;
        ok = this.terrain.heightAt(px, pz) < -6 && this.terrain.bridges?.heightAt(px, pz) == null;
      }
      if (ok) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(b[2] + 140, 0, isl.z);
  }

  _spawn(spec) {
    const rng = this.rng;
    let obj;
    const a = { type: spec.type, speed: 0, state: 'move', timer: 0, phase: rng() * 10 };
    if (spec.type === 'deer') { obj = makeDeer(rng); a.speed = 1.3; }
    else if (spec.type === 'rabbit') { obj = makeRabbit(); a.speed = 2.2; }
    else if (spec.type === 'duck') { obj = makeDuck(); a.speed = 0.6; }
    else if (spec.type === 'squirrel') { obj = makeSquirrel(); a.speed = 3.2; }
    else if (spec.type === 'peacock') { obj = makePeacock(); a.speed = 0.7; a.display = 0; }
    else if (spec.type === 'crab') { obj = makeCrab(); a.speed = 0.7; }
    else if (spec.type === 'turtle') { obj = makeTurtle(); a.speed = 0.35; }
    else if (spec.type === 'swan') { obj = makeSwan(); a.speed = 0.5; }
    else if (spec.type === 'dolphin') { obj = makeDolphin(); a.speed = 6 + rng() * 1.5; }
    else { obj = makeGull(); a.speed = 9 + rng() * 3; }
    a.island = this._islandFor(spec);
    if (spec.type === 'dolphin') {
      // Pods share a circle; members follow each other a few body lengths apart.
      const pod = this._pods || (this._pods = new Map());
      const key = a.island.id;
      if (!pod.has(key) || pod.get(key).size >= 3) {
        const radius = 35 + rng() * 30;
        pod.set(key, { center: this._poolCenter(a.island, radius), radius, angle: rng() * Math.PI * 2, dir: rng() < 0.5 ? 1 : -1, size: 0 });
      }
      const p = pod.get(key);
      a.center = p.center; a.radius = p.radius + (p.size - 1) * 2.5; a.dir = p.dir;
      a.angle = p.angle - p.dir * p.size * 0.12;
      a.nextJump = 2 + rng() * 6 + p.size * 0.35;
      a.jump = -1;
      p.size++;
    } else if (spec.type === 'gull') {
      a.center = new THREE.Vector3((rng() - 0.5) * 900, 0, (rng() - 0.5) * 900);
      a.radius = 25 + rng() * 50;
      a.alt = 16 + rng() * 22;
      a.angle = rng() * Math.PI * 2;
      a.dir = rng() < 0.5 ? 1 : -1;
    } else if (SWIMMERS.has(spec.type)) {
      obj.position.copy(this._waterPoint(a.island));
      a.target = this._waterPoint(a.island, obj.position);
    } else if (spec.type === 'crab') {
      obj.position.copy(this._beachPoint(a.island));
      a.target = this._beachPoint(a.island, obj.position);
    } else {
      obj.position.copy(this._landPoint(a.island));
      a.target = this._landPoint(a.island, obj.position);
    }
    if (spec.type === 'deer') obj.scale.setScalar(0.95 + rng() * 0.2);
    const info = { ...INFO[spec.type], id: `${spec.type}-${this.list.length}` };
    obj.traverse((o) => { o.userData.pick = info; });
    a.obj = obj;
    a.info = info;
    info.follow = obj;
    this.group.add(obj);
    this.ctx.pickables.push(obj);
    this.list.push(a);
  }

  update(dt, t) {
    for (const a of this.list) {
      const o = a.obj;
      if (a.type === 'dolphin') { this._updateDolphin(a, dt, t); continue; }
      if (a.type === 'gull') {
        a.angle += a.dir * dt * a.speed / a.radius;
        const x = a.center.x + Math.cos(a.angle) * a.radius;
        const z = a.center.z + Math.sin(a.angle) * a.radius;
        const y = a.alt + Math.sin(t * 0.4 + a.phase) * 3;
        o.position.set(x, y, z);
        o.rotation.set(0, Math.atan2(-Math.sin(a.angle) * a.dir, Math.cos(a.angle) * a.dir), -a.dir * 0.25);
        const flap = Math.sin(t * 7 + a.phase);
        const glide = (Math.sin(t * 0.5 + a.phase) > 0.2) ? 0.15 : 1;
        for (const w of o.userData.parts.wings) w.pivot.rotation.z = w.side * flap * 0.55 * glide;
        continue;
      }
      if (a.state === 'pause') {
        a.timer -= dt;
        if (a.type === 'deer') o.userData.parts.neck.rotation.x = THREE.MathUtils.lerp(o.userData.parts.neck.rotation.x, 1.2, dt * 2);
        if (a.type === 'peacock') a.display = Math.min(1, a.display + dt * 0.8);
        if (a.timer <= 0) {
          a.state = 'move';
          a.target = SWIMMERS.has(a.type) ? this._waterPoint(a.island, o.position)
            : a.type === 'crab' ? this._beachPoint(a.island, o.position) : this._landPoint(a.island, o.position);
        }
      } else {
        const dx = a.target.x - o.position.x, dz = a.target.z - o.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.6) {
          a.state = 'pause';
          a.timer = 2 + this.rng() * (a.type === 'deer' ? 7 : a.type === 'peacock' ? 9 : 3);
        } else {
          let step = a.speed * dt;
          if (a.type === 'rabbit' || a.type === 'squirrel') step *= Math.max(0, Math.sin((t + a.phase) * (a.type === 'squirrel' ? 10 : 7)));
          if (a.type === 'peacock') { a.display = Math.max(0, a.display - dt * 1.5); if (a.display > 0.05) step = 0; }
          o.position.x += dx / d * Math.min(step, d);
          o.position.z += dz / d * Math.min(step, d);
          // Crabs walk sideways.
          const yaw = Math.atan2(dx, dz) + (a.type === 'crab' ? Math.PI / 2 : 0);
          let diff = yaw - o.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          o.rotation.y += diff * Math.min(1, dt * 3);
          if (a.type === 'deer') {
            const ph = (t + a.phase) * 6;
            o.userData.parts.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.45; });
            o.userData.parts.neck.rotation.x = THREE.MathUtils.lerp(o.userData.parts.neck.rotation.x, 0, dt * 2);
          }
        }
      }
      this._animate(a, dt, t);
      if (SWIMMERS.has(a.type)) {
        o.position.y = Math.sin(t * 2 + a.phase) * 0.03 + (a.type === 'turtle' ? -0.08 : -0.02);
        a.timer2 = (a.timer2 || 0) - dt;
        if (a.timer2 <= 0 && a.state === 'move' && this.water) {
          this.water.addDrop(o.position.x, o.position.z, a.type === 'duck' ? 0.9 : 1.3, 0.025);
          a.timer2 = 0.35;
        }
      } else {
        let y = this.terrain.heightAt(o.position.x, o.position.z);
        const moving = a.state === 'move' ? 1 : 0;
        if (a.type === 'rabbit') y += Math.abs(Math.sin((t + a.phase) * 7)) * 0.25 * moving;
        if (a.type === 'squirrel') y += Math.abs(Math.sin((t + a.phase) * 10)) * 0.16 * moving;
        o.position.y = y - 0.02;
      }
    }
  }

  /** Per-species limb animation. */
  _animate(a, dt, t) {
    const parts = a.obj.userData.parts;
    const moving = a.state === 'move';
    if (a.type === 'squirrel') {
      parts.tail.rotation.x = -0.2 + Math.sin(t * (moving ? 10 : 3) + a.phase) * 0.15;
    } else if (a.type === 'peacock') {
      const k = a.display * a.display * (3 - 2 * a.display);
      parts.tail.rotation.x = 0.12 + k * 1.35;
      for (const { f, k: u } of parts.feathers) f.rotation.y = u * (0.35 + k * 2.6);
      parts.tail.rotation.z = Math.sin(t * 9) * 0.02 * k;
    } else if (a.type === 'crab') {
      const ph = (t + a.phase) * 14;
      parts.legs.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(ph + i * 1.3) * 0.5 : 0; });
      parts.claws.forEach((c, i) => { c.rotation.x = -0.3 + Math.sin(t * 2 + a.phase + i) * 0.25; });
    } else if (a.type === 'turtle') {
      const ph = (t + a.phase) * 2.2;
      for (const { f, side, front } of parts.flippers) {
        f.rotation.y = side * (front ? Math.sin(ph) * 0.6 : Math.sin(ph + 1.5) * 0.3);
      }
    }
  }

  _updateDolphin(a, dt, t) {
    const o = a.obj;
    a.angle += a.dir * dt * a.speed / a.radius;
    const x = a.center.x + Math.cos(a.angle) * a.radius;
    const z = a.center.z + Math.sin(a.angle) * a.radius;
    const yaw = Math.atan2(-Math.sin(a.angle) * a.dir, Math.cos(a.angle) * a.dir);
    let y = -0.35 + Math.sin(t * 1.6 + a.phase) * 0.12, pitch = Math.cos(t * 1.6 + a.phase) * 0.08;
    a.nextJump -= dt;
    if (a.jump < 0 && a.nextJump <= 0) { a.jump = 0; this._splash(x, z); }
    if (a.jump >= 0) {
      const T = 1.5;
      a.jump += dt / T;
      const u = a.jump;
      y = -0.4 + Math.sin(Math.PI * Math.min(u, 1)) * 2.6;
      pitch = (0.5 - u) * 1.8;
      if (u >= 1) { a.jump = -1; a.nextJump = 4 + this.rng() * 8; this._splash(x, z); }
    }
    o.position.set(x, y, z);
    o.rotation.set(0, 0, 0);
    o.rotateY(yaw);
    o.rotateX(-pitch);
    o.userData.parts.fluke.rotation.x = Math.sin(t * 6 + a.phase) * 0.35;
  }

  _splash(x, z) {
    if (this.water) for (let i = 0; i < 3; i++) this.water.addDrop(x + (this.rng() - 0.5) * 1.5, z + (this.rng() - 0.5) * 1.5, 1.6, 0.06);
  }
}
