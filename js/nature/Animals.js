// Animals: grazing deer, hopping rabbits and squirrels, peacocks that fan their tails, crabs scuttling
// sideways on the beaches, ducks, swans and sea turtles that leave ripples, leaping dolphins and circling gulls.
import { ANIMALS } from '../config/city.layout.js';
import { mulberry32 } from '../core/Utils.js';

const THREE = window.THREE;

const INFO = {
  deer: { name: '梅花鹿', nameEn: 'Sika Deer', category: '动物 Animal', description: '在林间草地上漫步、低头吃草的梅花鹿。' },
  rabbit: { name: '野兔', nameEn: 'Wild Rabbit', category: '动物 Animal', description: '在草地上蹦跳觅食的野兔。' },
  duck: { name: '绿头鸭', nameEn: 'Mallard Duck', category: '动物 Animal', description: '沿岸浅水区游弋的绿头鸭，身后会留下水波。' },
  gull: { name: '海鸥', nameEn: 'Seagull', category: '动物 Animal', description: '在海面与岛屿上空盘旋的海鸥。' },
  squirrel: { name: '松鼠', nameEn: 'Red Squirrel', category: '动物 Animal', description: '拖着蓬松大尾巴、在林间草地上蹦跳的小松鼠。' },
  peacock: { name: '孔雀', nameEn: 'Peacock', category: '动物 Animal', description: '蓝绿色羽毛的孔雀，停下来时会把长长的尾羽展开成扇形。' },
  crab: { name: '螃蟹', nameEn: 'Beach Crab', category: '动物 Animal', description: '在沙滩上横着走的小螃蟹，举着两只大钳子。' },
  turtle: { name: '海龟', nameEn: 'Sea Turtle', category: '动物 Animal', description: '在近岸浅水里慢慢划水的海龟。' },
  swan: { name: '天鹅', nameEn: 'Swan', category: '动物 Animal', description: '优雅的白天鹅，弯着长长的脖子在水面上滑行。' },
  dolphin: { name: '海豚', nameEn: 'Dolphin', category: '动物 Animal', description: '成群在深水区游弋的海豚，时不时跃出海面。' },
};

const SWIMMERS = new Set(['duck', 'turtle', 'swan']);

const mat = (color, rough = 0.85) => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).convertSRGBToLinear(), roughness: rough });

function part(geo, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}

function makeDeer(rng) {
  const g = new THREE.Group();
  const fur = mat(0x9a6233), light = mat(0xe8d6b8), dark = mat(0x2a1d14);
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  g.add(part(sphere, fur, 0, 1.05, 0, 0.32, 0.34, 0.68));
  g.add(part(sphere, light, 0, 0.92, 0.05, 0.25, 0.22, 0.55));
  const spots = new THREE.SphereGeometry(0.035, 6, 4);
  for (let i = 0; i < 14; i++) g.add(part(spots, light, (rng() < 0.5 ? -1 : 1) * 0.27, 1.12 + rng() * 0.16, -0.4 + rng() * 0.8));
  const neck = new THREE.Group();
  neck.position.set(0, 1.25, 0.5);
  neck.add(part(new THREE.CylinderGeometry(0.09, 0.13, 0.6, 10), fur, 0, 0.25, 0.08));
  neck.children[0].rotation.x = 0.5;
  const head = new THREE.Group();
  head.position.set(0, 0.55, 0.22);
  head.add(part(sphere, fur, 0, 0, 0.05, 0.12, 0.12, 0.2));
  head.add(part(sphere, dark, 0, -0.03, 0.24, 0.05, 0.05, 0.05));
  for (const s of [-1, 1]) {
    head.add(part(new THREE.ConeGeometry(0.05, 0.18, 8), fur, s * 0.1, 0.13, -0.04).rotateZ(s * -0.6));
    head.add(part(sphere, dark, s * 0.08, 0.05, 0.12, 0.022, 0.022, 0.022));
  }
  if (rng() < 0.6) {
    const antler = mat(0xcdb48a, 0.6);
    for (const s of [-1, 1]) {
      const a = part(new THREE.CylinderGeometry(0.015, 0.025, 0.42, 6), antler, s * 0.06, 0.28, -0.02);
      a.rotation.z = s * -0.35;
      head.add(a);
      const b = part(new THREE.CylinderGeometry(0.012, 0.018, 0.18, 6), antler, s * 0.12, 0.36, 0.06);
      b.rotation.x = 0.7;
      head.add(b);
    }
  }
  neck.add(head);
  g.add(neck);
  const legs = [];
  const legGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.8, 8);
  legGeo.translate(0, -0.4, 0);
  for (const [x, z] of [[-0.15, 0.42], [0.15, 0.42], [-0.15, -0.42], [0.15, -0.42]]) {
    const leg = part(legGeo, fur, x, 0.85, z);
    g.add(leg);
    legs.push(leg);
  }
  g.add(part(sphere, light, 0, 1.15, -0.68, 0.06, 0.1, 0.05));
  g.userData.parts = { legs, neck };
  return g;
}

function makeRabbit() {
  const g = new THREE.Group();
  const fur = mat(0x8c7a66), white = mat(0xf2efe8);
  const s = new THREE.SphereGeometry(1, 14, 10);
  g.add(part(s, fur, 0, 0.18, 0, 0.14, 0.14, 0.2));
  g.add(part(s, fur, 0, 0.3, 0.17, 0.09, 0.09, 0.1));
  for (const x of [-0.035, 0.035]) {
    const ear = part(s, fur, x, 0.46, 0.13, 0.025, 0.11, 0.035);
    ear.rotation.x = -0.3;
    g.add(ear);
  }
  g.add(part(s, white, 0, 0.2, -0.2, 0.05, 0.05, 0.05));
  return g;
}

function makeDuck() {
  const g = new THREE.Group();
  const s = new THREE.SphereGeometry(1, 14, 10);
  g.add(part(s, mat(0x8b7765), 0, 0.08, 0, 0.13, 0.1, 0.24));
  g.add(part(s, mat(0xd9d4cc), 0, 0.12, 0.02, 0.12, 0.07, 0.18));
  g.add(part(s, mat(0x1f5c3a, 0.4), 0, 0.27, 0.17, 0.07, 0.07, 0.08));
  g.add(part(new THREE.BoxGeometry(0.05, 0.02, 0.08), mat(0xf0a020, 0.5), 0, 0.25, 0.27));
  g.add(part(s, mat(0xf4f4f4), 0, 0.19, 0.13, 0.072, 0.012, 0.072));
  return g;
}

function makeGull() {
  const g = new THREE.Group();
  const s = new THREE.SphereGeometry(1, 14, 10);
  const white = mat(0xf6f6f4, 0.6), grey = mat(0xa7adb3, 0.6);
  g.add(part(s, white, 0, 0, 0, 0.12, 0.12, 0.38));
  g.add(part(s, white, 0, 0.06, 0.32, 0.09, 0.09, 0.1));
  g.add(part(new THREE.ConeGeometry(0.025, 0.12, 6), mat(0xf2c230), 0, 0.05, 0.46).rotateX(Math.PI / 2));
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.08, 0.04, 0.02);
    const wg = new THREE.BoxGeometry(0.75, 0.02, 0.24);
    wg.translate(side * 0.375, 0, 0);
    const w = new THREE.Mesh(wg, grey);
    w.castShadow = true;
    pivot.add(w);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.021, 0.16), mat(0x222222));
    tip.position.set(side * 0.68, 0, -0.02);
    pivot.add(tip);
    g.add(pivot);
    wings.push({ pivot, side });
  }
  g.add(part(new THREE.BoxGeometry(0.16, 0.02, 0.18), white, 0, 0, -0.42));
  g.userData.parts = { wings };
  return g;
}

function makeSquirrel() {
  const g = new THREE.Group();
  const fur = mat(0xa5522a), belly = mat(0xf0dcc0), dark = mat(0x1d1410);
  const s = new THREE.SphereGeometry(1, 14, 10);
  g.add(part(s, fur, 0, 0.13, 0, 0.08, 0.09, 0.13));
  g.add(part(s, belly, 0, 0.11, 0.05, 0.06, 0.06, 0.08));
  g.add(part(s, fur, 0, 0.24, 0.11, 0.06, 0.06, 0.065));
  for (const x of [-0.03, 0.03]) {
    g.add(part(new THREE.ConeGeometry(0.015, 0.05, 6), fur, x, 0.31, 0.1));
    g.add(part(s, dark, x * 1.3, 0.26, 0.16, 0.011, 0.011, 0.011));
  }
  // Bushy tail curling up over the back.
  const tail = new THREE.Group();
  tail.position.set(0, 0.14, -0.11);
  tail.add(part(s, fur, 0, 0.06, -0.06, 0.06, 0.08, 0.06));
  tail.add(part(s, fur, 0, 0.17, -0.07, 0.065, 0.09, 0.06));
  tail.add(part(s, fur, 0, 0.26, -0.02, 0.055, 0.06, 0.05));
  g.add(tail);
  g.userData.parts = { tail };
  return g;
}

function makePeacock() {
  const g = new THREE.Group();
  const blue = mat(0x1a4fa8, 0.45), green = mat(0x1f7a52, 0.5), brown = mat(0x6b4a2a), beak = mat(0xb9a07a);
  const s = new THREE.SphereGeometry(1, 16, 12);
  g.add(part(s, blue, 0, 0.62, 0, 0.17, 0.2, 0.3));
  g.add(part(new THREE.CylinderGeometry(0.045, 0.07, 0.42, 10), blue, 0, 0.9, 0.2).rotateX(0.35));
  g.add(part(s, blue, 0, 1.12, 0.27, 0.065, 0.07, 0.08));
  g.add(part(new THREE.ConeGeometry(0.02, 0.07, 6), beak, 0, 1.11, 0.36).rotateX(Math.PI / 2));
  for (let i = -1; i <= 1; i++) {
    const c = part(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 4), blue, i * 0.02, 1.22, 0.25);
    c.rotation.z = i * 0.25;
    g.add(c);
    g.add(part(s, blue, i * 0.035, 1.28, 0.25, 0.012, 0.012, 0.012));
  }
  for (const x of [-0.07, 0.07]) {
    const leg = part(new THREE.CylinderGeometry(0.015, 0.012, 0.46, 6), beak, x, 0.23, 0);
    g.add(leg);
  }
  g.add(part(s, brown, 0, 0.6, -0.2, 0.15, 0.12, 0.16));
  // Train of feathers: lies behind the bird while walking, fans up when displaying.
  const tail = new THREE.Group();
  tail.position.set(0, 0.62, -0.26);
  const feathers = [];
  const featherGeo = new THREE.SphereGeometry(1, 10, 6);
  const eyeGold = mat(0xd9a521, 0.4), eyeBlue = mat(0x13306e, 0.3);
  const N = 15;
  for (let i = 0; i < N; i++) {
    const f = new THREE.Group();
    const len = 1.0 + 0.25 * (1 - Math.abs(i - (N - 1) / 2) / ((N - 1) / 2));
    f.add(part(featherGeo, green, 0, 0, -len / 2, 0.07, 0.012, len / 2));
    f.add(part(featherGeo, eyeGold, 0, 0.006, -len + 0.1, 0.06, 0.013, 0.07));
    f.add(part(featherGeo, eyeBlue, 0, 0.012, -len + 0.1, 0.03, 0.013, 0.035));
    tail.add(f);
    feathers.push({ f, k: i / (N - 1) - 0.5 });
  }
  g.add(tail);
  g.userData.parts = { tail, feathers };
  return g;
}

function makeCrab() {
  const g = new THREE.Group();
  const shell = mat(0xd9502a, 0.6), dark = mat(0x111111);
  const s = new THREE.SphereGeometry(1, 12, 8);
  g.add(part(s, shell, 0, 0.07, 0, 0.12, 0.045, 0.09));
  for (const x of [-0.035, 0.035]) {
    g.add(part(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 4), shell, x, 0.12, 0.07));
    g.add(part(s, dark, x, 0.145, 0.07, 0.013, 0.013, 0.013));
  }
  const claws = [];
  for (const side of [-1, 1]) {
    const c = new THREE.Group();
    c.position.set(side * 0.1, 0.07, 0.07);
    c.add(part(s, shell, side * 0.03, 0.02, 0.05, 0.035, 0.03, 0.05));
    c.add(part(new THREE.BoxGeometry(0.012, 0.012, 0.05), shell, side * 0.045, 0.045, 0.08));
    g.add(c);
    claws.push(c);
  }
  const legs = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = part(new THREE.CylinderGeometry(0.008, 0.006, 0.13, 4), shell, side * 0.15, 0.04, -0.04 + i * 0.04);
      leg.rotation.z = side * 1.0;
      g.add(leg);
      legs.push(leg);
    }
  }
  g.userData.parts = { claws, legs };
  return g;
}

function makeTurtle() {
  const g = new THREE.Group();
  const shell = mat(0x5b5a2e, 0.55), skin = mat(0x8a8f5a, 0.7);
  const s = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  g.add(part(s, shell, 0, 0, 0, 0.42, 0.18, 0.52));
  const ball = new THREE.SphereGeometry(1, 12, 8);
  g.add(part(ball, skin, 0, 0, 0, 0.4, 0.06, 0.5));
  g.add(part(ball, skin, 0, 0.04, 0.6, 0.12, 0.09, 0.14));
  const flippers = [];
  for (const [x, z, front] of [[-0.38, 0.3, 1], [0.38, 0.3, 1], [-0.3, -0.38, 0], [0.3, -0.38, 0]]) {
    const f = part(ball, skin, x, 0, z, front ? 0.28 : 0.14, 0.025, front ? 0.1 : 0.08);
    flippers.push({ f, side: Math.sign(x), front });
    g.add(f);
  }
  g.userData.parts = { flippers };
  return g;
}

function makeSwan() {
  const g = new THREE.Group();
  const white = mat(0xf7f7f3, 0.6);
  const s = new THREE.SphereGeometry(1, 16, 12);
  g.add(part(s, white, 0, 0.14, 0, 0.24, 0.16, 0.42));
  g.add(part(s, white, 0, 0.24, -0.12, 0.2, 0.12, 0.3));
  const neck = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.2, 0.3), new THREE.Vector3(0, 0.45, 0.42), new THREE.Vector3(0, 0.7, 0.32), new THREE.Vector3(0, 0.82, 0.38),
  ]);
  g.add(part(new THREE.TubeGeometry(neck, 16, 0.045, 8, false), white, 0, 0, 0));
  g.add(part(s, white, 0, 0.83, 0.42, 0.05, 0.05, 0.08));
  g.add(part(new THREE.ConeGeometry(0.025, 0.12, 8), mat(0xe8742a, 0.5), 0, 0.81, 0.53).rotateX(Math.PI / 2));
  g.add(part(s, mat(0x151515), 0, 0.83, 0.47, 0.03, 0.03, 0.03));
  return g;
}

function makeDolphin() {
  const g = new THREE.Group();
  const grey = mat(0x6f7f8c, 0.35), belly = mat(0xd7dde2, 0.4);
  const s = new THREE.SphereGeometry(1, 18, 12);
  g.add(part(s, grey, 0, 0, 0, 0.32, 0.34, 1.2));
  g.add(part(s, belly, 0, -0.1, 0.1, 0.26, 0.22, 0.95));
  g.add(part(s, grey, 0, -0.04, 1.2, 0.08, 0.07, 0.3));
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 4), grey);
  fin.position.set(0, 0.38, -0.1); fin.scale.set(0.25, 1, 1); fin.rotation.x = -0.5; fin.castShadow = true;
  g.add(fin);
  for (const side of [-1, 1]) {
    g.add(part(s, grey, side * 0.32, -0.18, 0.35, 0.22, 0.03, 0.12).rotateY(side * 0.5));
  }
  const fluke = new THREE.Group();
  fluke.position.set(0, 0, -1.15);
  fluke.add(part(s, grey, 0, 0, -0.2, 0.09, 0.08, 0.3));
  for (const side of [-1, 1]) fluke.add(part(s, grey, side * 0.2, 0, -0.45, 0.24, 0.025, 0.1).rotateY(side * 0.4));
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
