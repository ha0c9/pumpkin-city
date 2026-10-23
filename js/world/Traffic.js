// Cars that drive on the right along the road graph (bridges included), turn on curves through junctions,
// stop for red lights (shared phase with the signals) and keep a safe gap to the car ahead.
import { ROAD_STYLE } from '../config/city.layout.js';
import { mergeColored, mulberry32 } from '../core/Utils.js';
import { signalState } from './StreetFurniture.js';

const THREE = window.THREE;

const CAR_TYPES = {
  sedan: { name: '轿车', nameEn: 'Sedan', length: 4.5, colors: [0xd8d8d8, 0x1d1f24, 0xb8202a, 0x2a4f8f, 0xf1f1ee, 0x6b6f75, 0x8a1c2b], weight: 5 },
  suv: { name: '越野车', nameEn: 'SUV', length: 4.8, colors: [0xf1f1ee, 0x2b2e33, 0x3e5f3a, 0x8a8f96, 0x1f3e66], weight: 3 },
  taxi: { name: '出租车', nameEn: 'Taxi', length: 4.5, colors: [0xf2c21b], weight: 2 },
  bus: { name: '公交车', nameEn: 'City Bus', length: 11, colors: [0x2f8f4a, 0xe8731a], weight: 1 },
};

/** Vehicle bodies built from boxes; the instance color tints the white body parts. Forward is local +Z. */
function carGeometry(type) {
  const parts = [];
  const add = (w, h, d, x, y, z, color, geo) => {
    const g = geo || new THREE.BoxGeometry(w, h, d);
    parts.push({ geometry: g, matrix: new THREE.Matrix4().makeTranslation(x, y, z), color });
  };
  const wheel = (x, z, r = 0.34, w = 0.26) => {
    const g = new THREE.CylinderGeometry(r, r, w, 12);
    g.rotateZ(Math.PI / 2);
    add(0, 0, 0, x, r, z, 0x1a1a1a, g);
  };
  const body = 0xffffff, glass = 0x26323d, trim = 0x2a2a2a;
  if (type === 'bus') {
    add(2.5, 2.6, 11, 0, 1.75, 0, body);
    add(2.52, 1.0, 10.2, 0, 2.3, -0.2, glass);
    add(2.4, 1.3, 0.06, 0, 2.2, 5.5, glass);
    add(2.56, 0.25, 11.06, 0, 0.6, 0, trim);
    add(1.6, 0.35, 2.6, 0, 3.2, -2, 0xdddddd);
    for (const z of [3.6, -3.4]) for (const x of [-1.1, 1.1]) wheel(x, z, 0.5, 0.32);
    return mergeColored(parts);
  }
  const L = type === 'suv' ? 4.8 : 4.5, W = type === 'suv' ? 1.95 : 1.8;
  const baseH = type === 'suv' ? 0.95 : 0.7, cabH = type === 'suv' ? 0.75 : 0.6;
  const y0 = type === 'suv' ? 0.42 : 0.3;
  add(W, baseH, L, 0, y0 + baseH / 2, 0, body);
  const cabL = type === 'suv' ? 2.9 : 2.3, cabZ = type === 'suv' ? -0.35 : -0.25;
  add(W - 0.12, cabH, cabL, 0, y0 + baseH + cabH / 2, cabZ, body);
  add(W - 0.1, cabH * 0.78, cabL + 0.04, 0, y0 + baseH + cabH * 0.45, cabZ, glass);
  add(W - 0.16, cabH * 0.75, 0.08, 0, y0 + baseH + cabH * 0.42, cabZ + cabL / 2 + 0.02, glass);
  add(W + 0.04, 0.16, L + 0.04, 0, y0 + 0.12, 0, trim);
  if (type === 'taxi') {
    add(0.7, 0.24, 0.3, 0, y0 + baseH + cabH + 0.12, cabZ, 0xf6f2d8);
    add(W + 0.02, 0.12, 2.0, 0, y0 + baseH * 0.6, -0.2, 0x1d1d1d);
  }
  const wz = L / 2 - 0.85;
  for (const z of [wz, -wz]) for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) wheel(x, z, type === 'suv' ? 0.4 : 0.33);
  return mergeColored(parts);
}

/** Head (front, warm white) and tail (rear, red) light quads for one vehicle type. */
function lightGeometry(type, front) {
  const L = type === 'bus' ? 11 : type === 'suv' ? 4.8 : 4.5;
  const W = type === 'bus' ? 2.5 : type === 'suv' ? 1.95 : 1.8;
  const y = type === 'bus' ? 0.95 : type === 'suv' ? 0.95 : 0.75;
  const geos = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.36, 0.14, 0.05);
    g.translate(sx * (W / 2 - 0.3), y, (front ? 1 : -1) * (L / 2 + 0.03));
    geos.push({ geometry: g });
  }
  return mergeColored(geos);
}

function bezier(p0, d0, p1, d1) {
  const dist = p0.distanceTo(p1);
  const k = Math.max(1.5, dist * 0.42);
  return new THREE.CubicBezierCurve3(p0.clone(), p0.clone().addScaledVector(d0, k), p1.clone().addScaledVector(d1, -k), p1.clone());
}

export class Traffic {
  constructor(ctx, roads, bridges, count) {
    this.ctx = ctx;
    this.rng = mulberry32(777);
    this._buildGraph(roads, bridges);
    this.cars = [];
    this.group = new THREE.Group();
    this.group.name = 'traffic';
    ctx.scene.add(this.group);
    this._buildMeshes(count);
  }

  _buildGraph(roads, bridges) {
    const nodes = roads.nodes;
    this.nodes = nodes;
    const edges = [];
    const out = new Map(nodes.map((n) => [n, []]));
    const trimFor = (n, axis) => (n.junction ? (axis === 'x' ? n.ex : n.ez) + 1.2 : 0);
    for (const r of roads.roads) {
      const along = r.nodesAlong || [];
      for (let i = 0; i < along.length - 1; i++) {
        const A = along[i].n, B = along[i + 1].n;
        for (const [P, Q, sgn] of [[A, B, 1], [B, A, -1]]) {
          const d = r.axis === 'x' ? new THREE.Vector3(sgn, 0, 0) : new THREE.Vector3(0, 0, sgn);
          const p0 = new THREE.Vector3(P.x, r.y + 0.03, P.z).addScaledVector(d, trimFor(P, r.axis));
          const p1 = new THREE.Vector3(Q.x, r.y + 0.03, Q.z).addScaledVector(d, -trimFor(Q, r.axis));
          const len = p0.distanceTo(p1);
          if (len < 1 || p1.clone().sub(p0).dot(d) <= 0) continue;
          const e = { from: P, to: Q, dir: d, endDir: d, axis: r.axis, lanes: r.lanes, road: r, len, p0, p1, bridge: null };
          edges.push(e);
          out.get(P).push(e);
        }
      }
    }
    // Bridge decks link the node at abutment A with the node at abutment B.
    const near = (x, z) => nodes.find((n) => Math.abs(n.x - x) < 0.6 && Math.abs(n.z - z) < 0.6);
    for (const b of bridges.items) {
      const NA = near(b.A.x, b.A.y), NB = near(b.B.x, b.B.y);
      if (!NA || !NB) continue;
      const DA = new THREE.Vector3(b.D.x, 0, b.D.y), DB = new THREE.Vector3(b.DB.x, 0, b.DB.y);
      for (const [P, Q, fwd] of [[NA, NB, true], [NB, NA, false]]) {
        const d = fwd ? DA.clone() : DB.clone().negate();
        const endDir = fwd ? DB.clone() : DA.clone().negate();
        const e = { from: P, to: Q, dir: d, endDir, axis: null, lanes: b.lanes, len: b.L, bridge: b, fwd };
        edges.push(e);
        out.get(P).push(e);
      }
    }
    this.edges = edges;
    this.out = out;
  }

  /** Position on an edge at distance s for lateral lane offset `off` (to the right of travel). */
  _edgePoint(e, s, off, outV) {
    if (e.bridge) {
      const u = THREE.MathUtils.clamp(s / e.len, 0, 1);
      return e.bridge.point(e.fwd ? u : 1 - u, e.fwd ? off : -off, 0.03, outV);
    }
    const t = s / e.len;
    outV.lerpVectors(e.p0, e.p1, t);
    outV.x += -e.dir.z * off; outV.z += e.dir.x * off;
    return outV;
  }

  _laneOffset(lanes) {
    const w = ROAD_STYLE.laneWidth;
    return lanes >= 4 && this.rng() < 0.5 ? w * 1.5 : w * 0.5;
  }

  _buildMeshes(count) {
    const types = Object.keys(CAR_TYPES);
    const weights = types.map((t) => CAR_TYPES[t].weight);
    const wsum = weights.reduce((a, b) => a + b, 0);
    const pickType = () => {
      let r = this.rng() * wsum;
      for (let i = 0; i < types.length; i++) { r -= weights[i]; if (r <= 0) return types[i]; }
      return types[0];
    };
    const plan = [];
    for (let i = 0; i < count; i++) plan.push(pickType());
    const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.55, envMapIntensity: 1.2 });
    this.ctx.wetMaterials.push({ material: bodyMat, dry: 0.35, wet: 0.15 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xfff0c8, emissiveIntensity: 0.1 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x8a1010, emissive: 0xff2a1a, emissiveIntensity: 0.15 });
    this.ctx.nightMaterials.push({ material: headMat, intensity: 2.2, base: 0.1 });
    this.ctx.nightMaterials.push({ material: tailMat, intensity: 1.6, base: 0.15 });
    this.meshes = {};
    const roadEdges = this.edges.filter((e) => !e.bridge && e.len > 12);
    for (const type of types) {
      const n = plan.filter((t) => t === type).length;
      if (!n) continue;
      const body = new THREE.InstancedMesh(carGeometry(type), bodyMat, n);
      const head = new THREE.InstancedMesh(lightGeometry(type, true), headMat, n);
      const tail = new THREE.InstancedMesh(lightGeometry(type, false), tailMat, n);
      body.castShadow = true; body.receiveShadow = true;
      for (const m of [body, head, tail]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; this.group.add(m); }
      const def = CAR_TYPES[type];
      const infos = [];
      const color = new THREE.Color();
      for (let i = 0; i < n; i++) {
        color.set(def.colors[Math.floor(this.rng() * def.colors.length)]);
        body.setColorAt(i, color);
        const car = this._spawn(type, def, roadEdges);
        car.mesh = body; car.head = head; car.tail = tail; car.index = i;
        infos.push({
          id: `car-${type}-${i}`, name: def.name, nameEn: def.nameEn, category: '交通 Traffic',
          description: type === 'bus' ? '南瓜岛公交，沿城市道路行驶，经桥梁往返各岛。' : '行驶在南瓜岛道路上的车辆，遵守红绿灯并保持车距。',
        });
      }
      body.instanceColor.needsUpdate = true;
      body.userData.pick = infos[0];
      body.userData.pickResolver = (hit) => infos[hit.instanceId] || infos[0];
      this.ctx.pickables.push(body);
      this.meshes[type] = body;
    }
  }

  _spawn(type, def, roadEdges) {
    let e, s;
    for (let k = 0; k < 60; k++) {
      e = roadEdges[Math.floor(this.rng() * roadEdges.length)];
      s = this.rng() * e.len;
      const p = new THREE.Vector3();
      this._edgePoint(e, s, 0, p);
      if (this.cars.every((c) => c.pos.distanceTo(p) > 14)) break;
    }
    const car = {
      type, length: def.length, edge: e, s, off: this._laneOffset(e.lanes), curve: null, curveLen: 0,
      speed: 0, vmax: (type === 'bus' ? 9 : 11) + this.rng() * 3, pos: new THREE.Vector3(), dir: e.dir.clone(),
      wait: 0,
    };
    this._edgePoint(e, s, car.off, car.pos);
    this.cars.push(car);
    return car;
  }

  /** Pick the next edge at the end node (no U-turns unless it is a dead end) and build the turn curve. */
  _advance(car) {
    const e = car.edge;
    const options = this.out.get(e.to).filter((n) => !(n.to === e.from && n.dir.dot(e.endDir) < -0.9));
    let next;
    if (!options.length) next = this.out.get(e.to).find((n) => n.to === e.from) || e;
    else {
      // Prefer going straight a bit more often than turning.
      const weights = options.map((o) => (o.dir.dot(e.endDir) > 0.9 ? 2.2 : 1));
      let r = this.rng() * weights.reduce((a, b) => a + b, 0);
      next = options[options.length - 1];
      for (let i = 0; i < options.length; i++) { r -= weights[i]; if (r <= 0) { next = options[i]; break; } }
    }
    const end = this._edgePoint(e, e.len, car.off, new THREE.Vector3());
    const off = next.lanes === e.lanes ? car.off : this._laneOffset(next.lanes);
    const start = this._edgePoint(next, 0, off, new THREE.Vector3());
    car.edge = next; car.off = off; car.s = 0;
    const startDir = next.dir;
    if (end.distanceTo(start) > 0.3) {
      const uturn = startDir.dot(e.endDir) < -0.9;
      car.curve = uturn
        ? new THREE.CubicBezierCurve3(end, end.clone().addScaledVector(e.endDir, 6), start.clone().addScaledVector(startDir, -6), start)
        : bezier(end, e.endDir, start, startDir);
      car.curveLen = car.curve.getLength();
      car.cs = 0;
    }
  }

  update(dt, time) {
    if (!this.cars.length) return;
    dt = Math.min(dt, 0.05);
    const cars = this.cars;
    // Gap keeping: distance to the nearest car ahead roughly in the same lane.
    for (const a of cars) {
      let gap = Infinity;
      a.blocker = null;
      for (const b of cars) {
        if (a === b) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const ahead = dx * a.dir.x + dz * a.dir.z;
        if (ahead <= 0 || ahead > 30) continue;
        const lateral = Math.abs(-dx * a.dir.z + dz * a.dir.x);
        if (lateral > 1.6 || Math.abs(b.pos.y - a.pos.y) > 2) continue;
        if (b.dir.x * a.dir.x + b.dir.z * a.dir.z < 0) continue;
        const g = ahead - (a.length + b.length) / 2;
        if (g < gap) { gap = g; a.blocker = b; }
      }
      a.gap = gap;
    }
    for (const car of cars) {
      let target = car.curve ? Math.min(car.vmax, 6) : car.vmax;
      // Keep ~2.5 m standstill gap and a 1.2 s headway; a car blocked for long (e.g. crossing paths in a
      // junction) creeps on so the network can never lock up.
      if (car.wait > 6) {
        target = Math.min(target, 3);
        car.wait += dt;
        if (car.wait > 8) car.wait = 0;
      } else if (car.gap < Infinity) {
        const v = Math.max(0, (car.gap - 2.5) / 1.2);
        target = Math.min(target, v);
        const inJunction = car.curve || car.blocker.curve;
        car.wait = v < 0.3 && inJunction ? car.wait + dt : 0;
      } else car.wait = 0;
      // Signals: stop before the stop line unless already committed.
      if (!car.curve && car.edge.to.signal && car.edge.axis) {
        const remain = car.edge.len - car.s;
        const state = signalState(car.edge.axis, time);
        if (state === 'red' || (state === 'yellow' && remain > 4)) {
          target = Math.min(target, Math.sqrt(Math.max(0, 2 * 4 * (remain - 1.0))));
        }
      }
      // Slow down for an upcoming junction turn.
      if (!car.curve && car.edge.to.junction) {
        const remain = car.edge.len - car.s;
        target = Math.min(target, 6 + remain * 0.35);
      }
      const acc = target > car.speed ? 2.6 : 6.5;
      car.speed += THREE.MathUtils.clamp(target - car.speed, -acc * dt, acc * dt);
      if (car.speed < 0.05 && target < 0.05) car.speed = 0;
      let step = car.speed * dt;
      if (car.curve) {
        car.cs += step;
        if (car.cs >= car.curveLen) { step = car.cs - car.curveLen; car.curve = null; }
        else step = 0;
      }
      if (!car.curve) {
        car.s += step;
        if (car.s >= car.edge.len) this._advance(car);
      }
      this._pose(car);
    }
    for (const m of this.group.children) m.instanceMatrix.needsUpdate = true;
  }

  _pose(car) {
    const p = car.pos, d = car.dir;
    if (car.curve) {
      const u = THREE.MathUtils.clamp(car.cs / car.curveLen, 0, 1);
      car.curve.getPointAt(u, p);
      car.curve.getTangentAt(u, d);
    } else {
      this._edgePoint(car.edge, car.s, car.off, p);
      if (car.edge.bridge) {
        const q = this._edgePoint(car.edge, Math.min(car.edge.len, car.s + 1), car.off, new THREE.Vector3());
        const q0 = this._edgePoint(car.edge, Math.max(0, car.s - 1), car.off, new THREE.Vector3());
        d.subVectors(q, q0).normalize();
      } else d.copy(car.edge.dir);
    }
    const m = this._m || (this._m = new THREE.Matrix4());
    const look = this._look || (this._look = new THREE.Vector3());
    look.copy(p).add(d);
    m.lookAt(look, p, this._up || (this._up = new THREE.Vector3(0, 1, 0)));
    m.setPosition(p);
    car.mesh.setMatrixAt(car.index, m);
    car.head.setMatrixAt(car.index, m);
    car.tail.setMatrixAt(car.index, m);
  }
}
