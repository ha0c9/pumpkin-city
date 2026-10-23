// A few animals: grazing deer, hopping rabbits, swimming ducks (that leave ripples) and circling gulls.
import { ANIMALS } from '../config/city.layout.js';
import { mulberry32 } from '../core/Utils.js';

const THREE = window.THREE;

const INFO = {
  deer: { name: '梅花鹿', nameEn: 'Sika Deer', category: '动物 Animal', description: '在林间草地上漫步、低头吃草的梅花鹿。' },
  rabbit: { name: '野兔', nameEn: 'Wild Rabbit', category: '动物 Animal', description: '在草地上蹦跳觅食的野兔。' },
  duck: { name: '绿头鸭', nameEn: 'Mallard Duck', category: '动物 Animal', description: '沿岸浅水区游弋的绿头鸭，身后会留下水波。' },
  gull: { name: '海鸥', nameEn: 'Seagull', category: '动物 Animal', description: '在海面与岛屿上空盘旋的海鸥。' },
};

const mat = (color, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough });

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

  _spawn(spec) {
    const rng = this.rng;
    let obj;
    const a = { type: spec.type, speed: 0, state: 'move', timer: 0, phase: rng() * 10 };
    if (spec.type === 'deer') { obj = makeDeer(rng); a.speed = 1.3; }
    else if (spec.type === 'rabbit') { obj = makeRabbit(); a.speed = 2.2; }
    else if (spec.type === 'duck') { obj = makeDuck(); a.speed = 0.6; }
    else { obj = makeGull(); a.speed = 9 + rng() * 3; }
    a.island = this._islandFor(spec);
    if (spec.type === 'gull') {
      a.center = new THREE.Vector3((rng() - 0.5) * 900, 0, (rng() - 0.5) * 900);
      a.radius = 25 + rng() * 50;
      a.alt = 16 + rng() * 22;
      a.angle = rng() * Math.PI * 2;
      a.dir = rng() < 0.5 ? 1 : -1;
    } else if (spec.type === 'duck') {
      obj.position.copy(this._waterPoint(a.island));
      a.target = this._waterPoint(a.island, obj.position);
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
        if (a.timer <= 0) {
          a.state = 'move';
          a.target = a.type === 'duck' ? this._waterPoint(a.island, o.position) : this._landPoint(a.island, o.position);
        }
      } else {
        const dx = a.target.x - o.position.x, dz = a.target.z - o.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.6) {
          a.state = 'pause';
          a.timer = 2 + this.rng() * (a.type === 'deer' ? 7 : 3);
        } else {
          let step = a.speed * dt;
          if (a.type === 'rabbit') step *= Math.max(0, Math.sin((t + a.phase) * 7));
          o.position.x += dx / d * Math.min(step, d);
          o.position.z += dz / d * Math.min(step, d);
          const yaw = Math.atan2(dx, dz);
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
      if (a.type === 'duck') {
        o.position.y = Math.sin(t * 2 + a.phase) * 0.03 - 0.02;
        a.timer2 = (a.timer2 || 0) - dt;
        if (a.timer2 <= 0 && a.state === 'move' && this.water) {
          this.water.addDrop(o.position.x, o.position.z, 0.9, 0.025);
          a.timer2 = 0.35;
        }
      } else {
        let y = this.terrain.heightAt(o.position.x, o.position.z);
        if (a.type === 'rabbit') y += Math.abs(Math.sin((t + a.phase) * 7)) * 0.25 * (a.state === 'move' ? 1 : 0);
        o.position.y = y - 0.02;
      }
    }
  }
}
