// Road network: carriageways with markings, intersections with zebra crossings, sidewalks, traffic lights.
import { ROADS, ROAD_STYLE } from '../config/city.layout.js';
import { roadTexture, asphaltTexture, paverTexture, applyWorldUV } from '../core/Textures.js';
import { mergeSimple } from '../core/Utils.js';

const THREE = window.THREE;
const EPS = 0.05;

function normalizeRoad(r, terrain) {
  const [ax, az] = r.from, [bx, bz] = r.to;
  const axis = Math.abs(bx - ax) >= Math.abs(bz - az) ? 'x' : 'z';
  const lanes = r.lanes || 2;
  const width = lanes * ROAD_STYLE.laneWidth;
  const fixed = axis === 'x' ? az : ax;
  let min = axis === 'x' ? ax : az, max = axis === 'x' ? bx : bz;
  let endMin = r.endA || 'auto', endMax = r.endB || 'auto';
  if (min > max) { [min, max] = [max, min]; [endMin, endMax] = [endMax, endMin]; }
  return {
    ...r, axis, lanes, width, total: width + ROAD_STYLE.sidewalk * 2, fixed, min, max, endMin, endMax,
    y: terrain.heightAt(r.from[0], r.from[1]),
  };
}

export class RoadNetwork {
  constructor(ctx, terrain, extraRoads = []) {
    this.ctx = ctx;
    this.roads = [...ROADS, ...extraRoads].map((r) => normalizeRoad(r, terrain));
    this.lamps = [];
    this.streetTrees = [];
    this.signals = [];
    this.group = new THREE.Group();
    this.group.name = 'roads';
    ctx.scene.add(this.group);

    this.paverMat = new THREE.MeshStandardMaterial({ map: paverTexture(), roughness: 0.82 });
    this.asphaltMat = new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.88, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.markMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ec, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    ctx.wetMaterials.push({ material: this.asphaltMat, dry: 0.88, wet: 0.2 });
    ctx.wetMaterials.push({ material: this.paverMat, dry: 0.82, wet: 0.35 });
    this.roadMats = new Map();

    this._findNodes();
    this.sidewalkGeos = [];
    this.markGeos = [];
    this.asphaltGeos = [];
    this._buildSegments();
    this._buildJunctions();
    this._finalize();
    for (const r of this.roads) {
      const len = r.max - r.min, mid = (r.min + r.max) / 2;
      const cx = r.axis === 'x' ? mid : r.fixed, cz = r.axis === 'x' ? r.fixed : mid;
      ctx.mask.addRect(cx, cz, r.axis === 'x' ? len + 1 : r.total + 1, r.axis === 'x' ? r.total + 1 : len + 1, 0, 'road');
    }
  }

  _roadMat(lanes) {
    if (!this.roadMats.has(lanes)) {
      const rt = roadTexture(lanes, ROAD_STYLE.laneWidth);
      const m = new THREE.MeshStandardMaterial({ map: rt.texture, roughness: 0.86, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      this.ctx.wetMaterials.push({ material: m, dry: 0.86, wet: 0.2 });
      this.roadMats.set(lanes, { material: m, unit: rt.unit });
    }
    return this.roadMats.get(lanes);
  }

  _findNodes() {
    const nodes = new Map();
    const key = (x, z) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
    const getNode = (x, z) => {
      const k = key(x, z);
      if (!nodes.has(k)) nodes.set(k, { x, z, roads: new Set(), arms: {} });
      return nodes.get(k);
    };
    const coords = (r, t) => (r.axis === 'x' ? [t, r.fixed] : [r.fixed, t]);
    for (const r of this.roads) {
      getNode(...coords(r, r.min)).roads.add(r);
      getNode(...coords(r, r.max)).roads.add(r);
    }
    for (const h of this.roads.filter((r) => r.axis === 'x')) {
      for (const v of this.roads.filter((r) => r.axis === 'z')) {
        const x = v.fixed, z = h.fixed;
        if (x >= h.min - EPS && x <= h.max + EPS && z >= v.min - EPS && z <= v.max + EPS) {
          const n = getNode(x, z); n.roads.add(h); n.roads.add(v);
        }
      }
    }
    // Arms and junction extents.
    for (const n of nodes.values()) {
      for (const r of n.roads) {
        const t = r.axis === 'x' ? n.x : n.z;
        if (t > r.min + EPS) n.arms[r.axis === 'x' ? '-x' : '-z'] = r;
        if (t < r.max - EPS) n.arms[r.axis === 'x' ? '+x' : '+z'] = r;
      }
      const hasX = n.arms['+x'] || n.arms['-x'];
      const hasZ = n.arms['+z'] || n.arms['-z'];
      n.junction = !!(hasX && hasZ);
      const xs = [...n.roads].filter((r) => r.axis === 'x');
      const zs = [...n.roads].filter((r) => r.axis === 'z');
      n.ez = Math.max(0, ...xs.map((r) => r.total / 2));
      n.ex = Math.max(0, ...zs.map((r) => r.total / 2));
      n.hcz = Math.max(0, ...xs.map((r) => r.width / 2));
      n.hcx = Math.max(0, ...zs.map((r) => r.width / 2));
      n.y = Math.max(...[...n.roads].map((r) => r.y));
    }
    this.nodes = [...nodes.values()];
  }

  _place(r, along, across, yOff) {
    return r.axis === 'x' ? new THREE.Vector3(along, r.y + yOff, r.fixed + across) : new THREE.Vector3(r.fixed + across, r.y + yOff, along);
  }

  _box(cx, cy, cz, sx, sy, sz, list) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(cx, cy, cz);
    list.push(applyWorldUV(g, 0.5));
  }

  _buildSegments() {
    const sw = ROAD_STYLE.sidewalk, ch = ROAD_STYLE.curbHeight;
    for (const r of this.roads) {
      const onRoad = this.nodes.filter((n) => n.roads.has(r))
        .map((n) => ({ n, t: r.axis === 'x' ? n.x : n.z })).sort((a, b) => a.t - b.t);
      for (let i = 0; i < onRoad.length - 1; i++) {
        const A = onRoad[i], B = onRoad[i + 1];
        const trimA = A.n.junction ? (r.axis === 'x' ? A.n.ex : A.n.ez) : 0;
        const trimB = B.n.junction ? (r.axis === 'x' ? B.n.ex : B.n.ez) : 0;
        const t0 = A.t + trimA, t1 = B.t - trimB;
        const len = t1 - t0;
        if (len < 0.3) continue;
        const mid = (t0 + t1) / 2;
        const { material, unit } = this._roadMat(r.lanes);
        const geo = new THREE.PlaneGeometry(r.width, len);
        geo.rotateX(-Math.PI / 2);
        const uv = geo.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * len / unit);
        if (r.axis === 'x') geo.rotateY(Math.PI / 2);
        const c = this._place(r, mid, 0, 0.03);
        geo.translate(c.x, c.y, c.z);
        const mesh = new THREE.Mesh(geo, material);
        mesh.receiveShadow = true;
        mesh.userData.pick = {
          id: r.id, name: r.name, nameEn: r.nameEn, category: '道路 Road',
          description: `${r.lanes} 车道城市道路，双黄中线、白色车道边线，两侧人行道与路灯。`,
        };
        this.group.add(mesh);
        this.ctx.pickables.push(mesh);

        for (const side of [-1, 1]) {
          const p = this._place(r, mid, side * (r.width / 2 + sw / 2), (ch - 0.3) / 2);
          if (r.axis === 'x') this._box(p.x, p.y, p.z, len, ch + 0.3, sw, this.sidewalkGeos);
          else this._box(p.x, p.y, p.z, sw, ch + 0.3, len, this.sidewalkGeos);
        }
        // Dead-end cap.
        for (const [node, t, end] of [[A.n, t0, r.endMin], [B.n, t1, r.endMax]]) {
          if (node.junction || end === 'bridge' || Object.keys(node.arms).length !== 1) continue;
          const p = this._place(r, t, 0, (ch - 0.3) / 2);
          const dirSign = t === t0 ? 1 : -1;
          if (r.axis === 'x') this._box(p.x + dirSign * 0.6, p.y, p.z, 1.2, ch + 0.3, r.total, this.sidewalkGeos);
          else this._box(p.x, p.y, p.z + dirSign * 0.6, r.total, ch + 0.3, 1.2, this.sidewalkGeos);
        }

        // Lamps (staggered) and street trees along the sidewalks.
        const spacing = ROAD_STYLE.lampSpacing;
        const count = Math.floor(len / spacing);
        if (count >= 1) {
          const step = len / count;
          for (let k = 0; k < count; k++) {
            const t = t0 + step * (k + 0.5);
            const side = k % 2 === 0 ? 1 : -1;
            const p = this._place(r, t, side * (r.width / 2 + 0.45), ch);
            const dir = r.axis === 'x' ? [0, -side] : [-side, 0];
            this.lamps.push({ x: p.x, y: p.y, z: p.z, dirX: dir[0], dirZ: dir[1] });
            if (r.endMin !== 'bridge' && r.endMax !== 'bridge' && r.y < 2.1) {
              for (const ts of [-1, 1]) {
                const tt = t + step * 0.25 * (ts === side ? 1 : -1);
                if (tt < t0 + 3 || tt > t1 - 3) continue;
                const q = this._place(r, tt, ts * (r.width / 2 + sw - 0.85), ch);
                this.streetTrees.push({ x: q.x, y: q.y, z: q.z });
              }
            }
          }
        }
      }
    }
  }

  _buildJunctions() {
    const ch = ROAD_STYLE.curbHeight;
    for (const n of this.nodes) {
      if (!n.junction) continue;
      const { x, z, ex, ez, hcx, hcz } = n;
      const y = n.y;
      const asphalt = new THREE.PlaneGeometry(ex * 2, ez * 2);
      asphalt.rotateX(-Math.PI / 2);
      asphalt.translate(x, y + 0.03, z);
      this.asphaltGeos.push(applyWorldUV(asphalt, 0.08));
      const swx = ex - hcx, swz = ez - hcz;
      const cy = y + (ch - 0.3) / 2;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          this._box(x + sx * (hcx + swx / 2), cy, z + sz * (hcz + swz / 2), swx, ch + 0.3, swz, this.sidewalkGeos);
        }
      }
      const sides = [
        { arm: '-z', d: [0, -1] }, { arm: '+z', d: [0, 1] }, { arm: '-x', d: [-1, 0] }, { arm: '+x', d: [1, 0] },
      ];
      for (const s of sides) {
        const alongX = s.d[0] !== 0;
        const bandDepth = alongX ? swx : swz;
        const bandHalfLen = alongX ? hcz : hcx;
        const offset = (alongX ? hcx : hcz) + bandDepth / 2;
        const bx = x + s.d[0] * offset, bz = z + s.d[1] * offset;
        if (!n.arms[s.arm]) {
          if (alongX) this._box(bx, cy, bz, bandDepth, ch + 0.3, bandHalfLen * 2, this.sidewalkGeos);
          else this._box(bx, cy, bz, bandHalfLen * 2, ch + 0.3, bandDepth, this.sidewalkGeos);
          continue;
        }
        // Zebra crossing.
        const stripeW = 0.45, gap = 0.5;
        const stripeLen = bandDepth - 0.4;
        const nStripes = Math.floor((bandHalfLen * 2 - 0.6) / (stripeW + gap));
        const startOff = -((nStripes - 1) * (stripeW + gap)) / 2;
        for (let i = 0; i < nStripes; i++) {
          const o = startOff + i * (stripeW + gap);
          const g = alongX ? new THREE.PlaneGeometry(stripeLen, stripeW) : new THREE.PlaneGeometry(stripeW, stripeLen);
          g.rotateX(-Math.PI / 2);
          g.translate(alongX ? bx : bx + o, y + 0.05, alongX ? bz + o : bz);
          this.markGeos.push(g);
        }
        // Stop line across the inbound half (traffic drives on the right).
        const right = [s.d[1], -s.d[0]];
        const stopOff = (alongX ? ex : ez) + 0.5;
        const sxp = x + s.d[0] * stopOff + right[0] * bandHalfLen / 2;
        const szp = z + s.d[1] * stopOff + right[1] * bandHalfLen / 2;
        const sl = alongX ? new THREE.PlaneGeometry(0.4, bandHalfLen - 0.3) : new THREE.PlaneGeometry(bandHalfLen - 0.3, 0.4);
        sl.rotateX(-Math.PI / 2);
        sl.translate(sxp, y + 0.05, szp);
        this.markGeos.push(sl);

        // Traffic signal on the near-right corner for traffic arriving from this arm.
        if (Object.keys(n.arms).length >= 3) {
          const px = x + s.d[0] * ((alongX ? hcx : hcz) + bandDepth / 2) + right[0] * ((alongX ? hcz : hcx) + (alongX ? swz : swx) / 2);
          const pz = z + s.d[1] * ((alongX ? hcx : hcz) + bandDepth / 2) + right[1] * ((alongX ? hcz : hcx) + (alongX ? swz : swx) / 2);
          this.signals.push({ x: px, y: y + ch, z: pz, face: s.d, armOver: [-right[0], -right[1]], axis: alongX ? 'x' : 'z', reach: bandHalfLen * 0.7 });
        }
      }
      const pick = new THREE.Mesh(new THREE.BoxGeometry(ex * 2, 0.1, ez * 2), new THREE.MeshBasicMaterial({ visible: false }));
      pick.position.set(x, y + 0.05, z);
      pick.userData.pick = { id: `junction-${x}-${z}`, name: '十字路口', nameEn: 'Intersection', category: '道路 Road',
        description: '带斑马线、停止线与交通信号灯的路口。' };
      this.group.add(pick);
      this.ctx.pickables.push(pick);
    }
  }

  _finalize() {
    const add = (geos, mat, shadow) => {
      if (!geos.length) return;
      const m = new THREE.Mesh(mergeSimple(geos), mat);
      m.receiveShadow = true; m.castShadow = shadow;
      this.group.add(m);
      return m;
    };
    const sidewalks = add(this.sidewalkGeos, this.paverMat, true);
    if (sidewalks) {
      sidewalks.userData.pick = { id: 'sidewalks', name: '人行道', nameEn: 'Sidewalk', category: '道路 Road', description: '铺装人行道，路缘石高 16 厘米。' };
      this.ctx.pickables.push(sidewalks);
    }
    add(this.asphaltGeos, this.asphaltMat, false);
    add(this.markGeos, this.markMat, false);
  }
}
