// Cars that drive on the right along the road graph (bridges included), turn on curves through junctions,
// stop for red lights (shared phase with the signals) and keep a safe gap to the car ahead.
import { ROAD_STYLE } from '../config/city.layout.js';
import { mergeColored, mulberry32, mergeSimple, makeCanvas, canvasTexture } from '../core/Utils.js';
import { signalState } from './StreetFurniture.js';
import {
  AMBULANCE_LENGTH, AMBULANCE_WIDTH, ambulanceBodyGeometry, ambulanceSignGeometry,
  ambulanceLampGeometry, redCrossMap,
} from './ambulanceModel.js';

const THREE = window.THREE;

const CAR_TYPES = {
  sedan: { name: '轿车', nameEn: 'Sedan', length: 4.5, colors: [0x1d1f24, 0xb8202a, 0x2a4f8f, 0xf1f1ee, 0x8a1c2b], weight: 5 },
  suv: { name: '越野车', nameEn: 'SUV', length: 4.8, colors: [0xf1f1ee, 0x2b2e33, 0x3e5f3a, 0x1f3e66], weight: 3 },
  // Replaces the old gray sedans and SUVs. White body, blue stripe, roof light bar.
  police: { name: '警车', nameEn: 'Police Cruiser', length: 4.7, colors: [0xffffff], weight: 2 },
  ambulance: { name: '救护车', nameEn: 'Ambulance', length: AMBULANCE_LENGTH, colors: [0xffffff], weight: 0 },
  taxi: { name: '出租车', nameEn: 'Taxi', length: 4.5, colors: [0xf2c21b], weight: 2 },
  bus: { name: '公交车', nameEn: 'City Bus', length: 11, colors: [0x2f8f4a], weight: 0 },
};

/** Bus routes: every route always has at least one bus on the road. */
export const BUS_ROUTES = [
  { no: '113', color: 0x2f9a52, from: '南瓜中心岛', to: '北原岛' },
  { no: '138', color: 0x2c6fc0, from: '东林岛', to: '东方明珠岛' },
  { no: '328', color: 0xe8731a, from: '西岭岛', to: '南湾岛' },
  { no: '71', color: 0xc7302b, from: '中运量', to: '南瓜大道' },
];

/** LED route board: amber number + destination on black. */
function routeTexture(route) {
  const c = makeCanvas(512, 128);
  const x = c.getContext('2d');
  x.fillStyle = '#0b0b0d'; x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#ffb21a'; x.textBaseline = 'middle';
  x.shadowColor = '#ff8a00'; x.shadowBlur = 10;
  x.font = 'bold 92px "Helvetica Neue",Arial,sans-serif';
  x.textAlign = 'left';
  x.fillText(route.no, 16, 66);
  const w = x.measureText(route.no).width;
  x.font = 'bold 40px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  x.fillText('路', 22 + w, 82);
  x.textAlign = 'center';
  const cx = (70 + w + 512) / 2;
  x.font = 'bold 36px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  x.fillText(route.from, cx, 40);
  x.fillText('⇄ ' + route.to, cx, 90);
  return canvasTexture(c, { anisotropy: 8 });
}

/** Route boards on a bus: above the windscreen, on the rear and on both sides (local +Z is forward). */
function routeSignGeometry() {
  const geos = [];
  const quad = (w, h, x, y, z, ry) => {
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateY(ry);
    g.translate(x, y, z);
    geos.push(g);
  };
  quad(2.0, 0.42, 0, 2.8, 5.54, 0);
  quad(1.2, 0.3, 0, 2.86, -5.54, Math.PI);
  quad(2.2, 0.4, 1.27, 2.86, 3.2, Math.PI / 2);
  quad(2.2, 0.4, -1.27, 2.86, 3.2, -Math.PI / 2);
  return mergeSimple(geos);
}

/** Door boards for a patrol car. Local +Z is forward. */
function policeSignTexture() {
  const c = makeCanvas(512, 128);
  const x = c.getContext('2d');
  x.fillStyle = '#143a86';
  x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#f4f7fb';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = 'bold 72px "Helvetica Neue",Arial,sans-serif';
  x.fillText('POLICE', 256, 64);
  return canvasTexture(c, { anisotropy: 4 });
}

function policeSignGeometry() {
  const geos = [];
  const quad = (x, ry) => {
    const g = new THREE.PlaneGeometry(1.2, 0.32);
    g.rotateY(ry);
    g.translate(x, 1.02, 0.25);
    geos.push(g);
  };
  quad(0.94, Math.PI / 2);
  quad(-0.94, -Math.PI / 2);
  return mergeSimple(geos);
}

/** One lamp of the roof light bar, in car-local space. */
function policeLampGeometry(red) {
  const g = new THREE.BoxGeometry(0.26, 0.1, 0.16);
  g.translate(red ? -0.2 : 0.2, 1.68, 0.05);
  return g;
}

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
  if (type === 'police') {
    const L = 4.7, W = 1.86, baseH = 0.64, cabH = 0.56, y0 = 0.32;
    const cabL = 2.25, cabZ = -0.1;
    add(W, baseH, L, 0, y0 + baseH / 2, 0, body);
    add(W - 0.1, cabH, cabL, 0, y0 + baseH + cabH / 2, cabZ, body);
    add(W - 0.08, cabH * 0.72, cabL + 0.02, 0, y0 + baseH + cabH * 0.42, cabZ, glass);
    add(W - 0.14, cabH * 0.7, 0.06, 0, y0 + baseH + cabH * 0.4, cabZ + cabL / 2 + 0.02, glass);
    add(W + 0.03, 0.22, L * 0.62, 0, y0 + baseH * 0.55, 0.2, 0x163a86);
    add(W - 0.25, 0.05, 1.15, 0, y0 + baseH + 0.03, L / 2 - 0.75, 0x163a86);
    add(W + 0.03, 0.14, L + 0.02, 0, y0 + 0.1, 0, trim);
    add(W - 0.35, 0.12, 0.1, 0, y0 + 0.4, L / 2 + 0.02, 0x202226);
    add(0.78, 0.1, 0.32, 0, y0 + baseH + cabH + 0.06, 0.05, 0x1a1a1a);
    const wz = L / 2 - 0.85;
    for (const z of [wz, -wz]) for (const x of [-W / 2 + 0.08, W / 2 - 0.08]) wheel(x, z, 0.34);
    return mergeColored(parts);
  }
  if (type === 'ambulance') return ambulanceBodyGeometry();
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
  const L = type === 'bus' ? 11 : type === 'suv' ? 4.8 : type === 'police' ? 4.7 : type === 'ambulance' ? AMBULANCE_LENGTH : 4.5;
  const W = type === 'bus' ? 2.5 : type === 'suv' ? 1.95 : type === 'police' ? 1.86 : type === 'ambulance' ? AMBULANCE_WIDTH : 1.8;
  const y = type === 'bus' ? 0.95 : type === 'suv' ? 0.95 : type === 'police' ? 0.72 : type === 'ambulance' ? 0.85 : 0.75;
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
    const buses = count >= 40 ? BUS_ROUTES.length * 2 : BUS_ROUTES.length;
    for (let i = 0; i < count; i++) plan.push(i < buses ? 'bus' : pickType());
    for (let i = 0; i < 3; i++) plan.push('ambulance');
    const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.55, envMapIntensity: 1.2 });
    this.ctx.wetMaterials.push({ material: bodyMat, dry: 0.35, wet: 0.15 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xfff0c8, emissiveIntensity: 0.1 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x8a1010, emissive: 0xff2a1a, emissiveIntensity: 0.15 });
    this.ctx.nightMaterials.push({ material: headMat, intensity: 2.2, base: 0.1 });
    this.ctx.nightMaterials.push({ material: tailMat, intensity: 1.6, base: 0.15 });
    this.meshes = {};
    const busTotal = plan.filter((t) => t === 'bus').length;
    const signs = BUS_ROUTES.map((route, k) => {
      const map = routeTexture(route);
      const mat = new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.35, roughness: 0.5 });
      this.ctx.nightMaterials.push({ material: mat, intensity: 1.4, base: 0.35 });
      const n = Math.ceil((busTotal - k) / BUS_ROUTES.length);
      const mesh = new THREE.InstancedMesh(this._signGeo || (this._signGeo = routeSignGeometry()), mat, Math.max(1, n));
      mesh.count = Math.max(0, n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return { mesh, used: 0 };
    });
    const roadEdges = this.edges.filter((e) => !e.bridge && e.len > 12);
    for (const type of types) {
      const n = plan.filter((t) => t === type).length;
      if (!n) continue;
      const body = new THREE.InstancedMesh(carGeometry(type), bodyMat, n);
      const head = new THREE.InstancedMesh(lightGeometry(type, true), headMat, n);
      const tail = new THREE.InstancedMesh(lightGeometry(type, false), tailMat, n);
      body.castShadow = true; body.receiveShadow = true;
      const extras = [body, head, tail];
      let policeSign = null;
      let policeRed = null;
      let policeBlue = null;
      if (type === 'police') {
        const map = policeSignTexture();
        const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.45, metalness: 0.05 });
        policeSign = new THREE.InstancedMesh(policeSignGeometry(), mat, n);
        const redMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff1a1a, emissiveIntensity: 0.4 });
        const blueMat = new THREE.MeshStandardMaterial({ color: 0x2a6bff, emissive: 0x1a4dff, emissiveIntensity: 0.4 });
        this.policeRedMat = redMat;
        this.policeBlueMat = blueMat;
        policeRed = new THREE.InstancedMesh(policeLampGeometry(true), redMat, n);
        policeBlue = new THREE.InstancedMesh(policeLampGeometry(false), blueMat, n);
        extras.push(policeSign, policeRed, policeBlue);
      }
      let ambSign = null;
      let ambRed = null;
      let ambRed2 = null;
      if (type === 'ambulance') {
        const map = redCrossMap();
        const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.45, metalness: 0.05 });
        ambSign = new THREE.InstancedMesh(ambulanceSignGeometry(), mat, n);
        const redMat = new THREE.MeshStandardMaterial({ color: 0xd0121a, emissive: 0xff1a1a, emissiveIntensity: 0.4 });
        const redMat2 = new THREE.MeshStandardMaterial({ color: 0xd0121a, emissive: 0xff1a1a, emissiveIntensity: 0.4 });
        this.ambRedMat = redMat;
        this.ambRedMat2 = redMat2;
        ambRed = new THREE.InstancedMesh(ambulanceLampGeometry(true), redMat, n);
        ambRed2 = new THREE.InstancedMesh(ambulanceLampGeometry(false), redMat2, n);
        extras.push(ambSign, ambRed, ambRed2);
      }
      for (const m of extras) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; this.group.add(m); }
      const def = CAR_TYPES[type];
      const infos = [];
      const color = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const route = type === 'bus' ? BUS_ROUTES[i % BUS_ROUTES.length] : null;
        if (route) color.set(route.color).convertSRGBToLinear();
        else color.set(def.colors[Math.floor(this.rng() * def.colors.length)]);
        body.setColorAt(i, color);
        const car = this._spawn(type, def, roadEdges);
        car.mesh = body; car.head = head; car.tail = tail; car.index = i;
        if (route) {
          const sign = signs[i % BUS_ROUTES.length];
          car.sign = sign.mesh; car.signIndex = sign.used++;
        }
        if (policeSign) {
          car.sign = policeSign; car.signIndex = i;
          car.lampRed = policeRed; car.lampBlue = policeBlue;
        }
        if (ambSign) {
          car.sign = ambSign; car.signIndex = i;
          car.lampRed = ambRed; car.lampBlue = ambRed2;
        }
        infos.push(route ? {
          id: `bus-${route.no}-${i}`, name: `${route.no}路公交车`, nameEn: `Bus Route ${route.no}`, category: '交通 Traffic',
          description: `${route.no}路：${route.from} ⇄ ${route.to}。车头、车尾和车身两侧的 LED 路牌显示线路号，经桥梁往返各岛。`,
        } : {
          id: `car-${type}-${i}`, name: def.name, nameEn: def.nameEn, category: '交通 Traffic',
          description: type === 'police'
            ? '南瓜岛动物城警察局的巡逻车：白车身、蓝条纹和车顶警灯，沿南瓜中心岛的街道巡逻，也会过桥但会绕回来。'
            : type === 'ambulance'
              ? '从南瓜岛医院出发的救护车：白车身、红十字和车顶红灯，先沿雾林路、北原路离开医院，再驶入城市。'
              : '行驶在南瓜岛道路上的车辆，遵守红绿灯并保持车距。',
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
    let pool = roadEdges;
    if (type === 'police') {
      const downtown = roadEdges.filter((e) => Math.abs(e.p0.x) < 170 && Math.abs(e.p0.z) < 160 && Math.abs(e.p1.x) < 170 && Math.abs(e.p1.z) < 160);
      if (downtown.length) pool = downtown;
    }
    if (type === 'ambulance') return this._spawnAmbulance(def, roadEdges);
    let e, s;
    for (let k = 0; k < 60; k++) {
      e = pool[Math.floor(this.rng() * pool.length)];
      s = this.rng() * e.len;
      const p = new THREE.Vector3();
      this._edgePoint(e, s, 0, p);
      if (this.cars.every((c) => c.pos.distanceTo(p) > 14)) break;
    }
    const car = {
      type, length: def.length, edge: e, s, off: this._laneOffset(e.lanes), curve: null, curveLen: 0,
      speed: 0, vmax: (type === 'bus' ? 9 : type === 'police' ? 10 : 11) + this.rng() * 3, pos: new THREE.Vector3(), dir: e.dir.clone(),
      wait: 0, patrol: type === 'police',
    };
    this._edgePoint(e, s, car.off, car.pos);
    this.cars.push(car);
    return car;
  }

  /** Ambulances leave the hospital: two on 雾林路 heading toward 北原路, one already turning south for the bridge. */
  _spawnAmbulance(def, roadEdges) {
    const starts = [
      { road: 'wulin', axis: 'x', sign: -1, at: 12 },
      { road: 'wulin', axis: 'x', sign: -1, at: -18 },
      { road: 'beiyuan', axis: 'z', sign: 1, at: -460 },
    ];
    const spec = starts[(this._ambI = (this._ambI || 0) + 1) - 1] || starts[0];
    const covers = (e) => {
      const dir = spec.axis === 'x' ? e.dir.x : e.dir.z;
      if (e.road?.id !== spec.road || dir * spec.sign < 0.5) return false;
      const a = spec.axis === 'x' ? e.p0.x : e.p0.z;
      const b = spec.axis === 'x' ? e.p1.x : e.p1.z;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      return spec.at >= lo - 1 && spec.at <= hi + 1;
    };
    let e = roadEdges.find(covers) || roadEdges[0];
    const origin = spec.axis === 'x' ? e.p0.x : e.p0.z;
    const dir = spec.axis === 'x' ? e.dir.x : e.dir.z;
    let s = dir ? (spec.at - origin) / dir : e.len * 0.5;
    s = Math.max(3, Math.min(e.len - 3, s));
    const car = {
      type: 'ambulance', length: def.length, edge: e, s, off: this._laneOffset(e.lanes), curve: null, curveLen: 0,
      speed: 0, vmax: 12 + this.rng() * 2, pos: new THREE.Vector3(), dir: e.dir.clone(),
      wait: 0, patrol: false,
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
      // Patrol cars stay on the central island and head back if a bridge has taken them off it.
      const weights = options.map((o) => {
        const straight = o.dir.dot(e.endDir) > 0.9 ? 2.2 : 1;
        if (!car.patrol) return straight;
        const mx = (o.from.x + o.to.x) * 0.5, mz = (o.from.z + o.to.z) * 0.5;
        const central = mx * mx + mz * mz < 210 * 210;
        const inward = o.to.x * o.to.x + o.to.z * o.to.z <= o.from.x * o.from.x + o.from.z * o.from.z + 80;
        return straight * (central ? 4 : 0.3) * (inward || central ? 1 : 0.4);
      });
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
    if (this.policeRedMat) {
      const f = 0.5 + 0.5 * Math.sin(time * 14);
      this.policeRedMat.emissiveIntensity = 0.25 + f * 2.8;
      this.policeBlueMat.emissiveIntensity = 0.25 + (1 - f) * 2.8;
    }
    if (this.ambRedMat) {
      const f = 0.5 + 0.5 * Math.sin(time * 12);
      this.ambRedMat.emissiveIntensity = 0.2 + f * 2.6;
      this.ambRedMat2.emissiveIntensity = 0.2 + (1 - f) * 2.6;
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
    if (car.sign) car.sign.setMatrixAt(car.signIndex, m);
    if (car.lampRed) {
      car.lampRed.setMatrixAt(car.index, m);
      car.lampBlue.setMatrixAt(car.index, m);
    }
  }
}
