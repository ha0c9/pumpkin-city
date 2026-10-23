// Road network: carriageways with markings, intersections with zebra crossings, sidewalks,
// traffic-light positions and road-name signs. Also exposes the node graph used by traffic.
import { ROADS, ROAD_STYLE } from '../config/city.layout.js';
import { roadTexture, asphaltTexture, paverTexture, applyWorldUV } from '../core/Textures.js';
import { mergeSimple, makeCanvas, canvasTexture } from '../core/Utils.js';

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

/** One canvas atlas with every road name, used by all sign blades (single draw call). */
class SignAtlas {
  constructor(names) {
    this.cols = 2;
    this.cellW = 512; this.cellH = 128;
    this.rows = Math.ceil(names.length / this.cols);
    const c = makeCanvas(this.cellW * this.cols, THREE.MathUtils.ceilPowerOfTwo(Math.max(1, this.rows) * this.cellH));
    this.H = c.height;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
    this.slots = new Map();
    names.forEach((n, i) => {
      const cx = (i % this.cols) * this.cellW, cy = Math.floor(i / this.cols) * this.cellH;
      x.fillStyle = '#ffffff'; x.fillRect(cx, cy, this.cellW, this.cellH);
      x.fillStyle = '#1d4f9c'; x.fillRect(cx + 6, cy + 6, this.cellW - 12, this.cellH - 12);
      x.strokeStyle = '#ffffff'; x.lineWidth = 4; x.strokeRect(cx + 14, cy + 14, this.cellW - 28, this.cellH - 28);
      x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = 'bold 58px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
      x.fillText(n.name, cx + this.cellW / 2, cy + 54);
      x.font = '600 24px "Helvetica Neue",Arial,sans-serif';
      x.fillText(n.nameEn.toUpperCase(), cx + this.cellW / 2, cy + 98);
      this.slots.set(n.name, { u0: cx / c.width, u1: (cx + this.cellW) / c.width, v0: 1 - (cy + this.cellH) / c.height, v1: 1 - cy / c.height });
    });
    this.texture = canvasTexture(c, { anisotropy: 8 });
  }
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
    this.segmentGeos = new Map(); // lanes -> { geos: [], infos: [] }

    this._findNodes();
    this.sidewalkGeos = [];
    this.markGeos = [];
    this.asphaltGeos = [];
    this.junctionPicks = [];
    this._buildSegments();
    this._buildJunctions();
    this._buildSigns();
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
    for (const n of nodes.values()) {
      for (const r of n.roads) {
        const t = r.axis === 'x' ? n.x : n.z;
        if (t > r.min + EPS) n.arms[r.axis === 'x' ? '-x' : '-z'] = r;
        if (t < r.max - EPS) n.arms[r.axis === 'x' ? '+x' : '+z'] = r;
      }
      const hasX = n.arms['+x'] || n.arms['-x'];
      const hasZ = n.arms['+z'] || n.arms['-z'];
      n.junction = !!(hasX && hasZ);
      n.signal = n.junction && Object.keys(n.arms).length >= 3;
      const xs = [...n.roads].filter((r) => r.axis === 'x');
      const zs = [...n.roads].filter((r) => r.axis === 'z');
      n.ez = Math.max(0, ...xs.map((r) => r.total / 2));
      n.ex = Math.max(0, ...zs.map((r) => r.total / 2));
      n.hcz = Math.max(0, ...xs.map((r) => r.width / 2));
      n.hcx = Math.max(0, ...zs.map((r) => r.width / 2));
      n.y = Math.max(...[...n.roads].map((r) => r.y));
      n.bridgeEnd = [...n.roads].some((r) => {
        const t = r.axis === 'x' ? n.x : n.z;
        return (Math.abs(t - r.min) < EPS && r.endMin === 'bridge') || (Math.abs(t - r.max) < EPS && r.endMax === 'bridge');
      });
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

  _roadInfo(r) {
    return {
      id: r.id, name: r.name, nameEn: r.nameEn, category: '道路 Road',
      description: `${r.lanes} 车道城市道路，双黄中线、白色车道边线，两侧人行道、路灯与路名牌。`,
    };
  }

  _buildSegments() {
    const sw = ROAD_STYLE.sidewalk, ch = ROAD_STYLE.curbHeight;
    for (const r of this.roads) {
      const info = this._roadInfo(r);
      const onRoad = this.nodes.filter((n) => n.roads.has(r))
        .map((n) => ({ n, t: r.axis === 'x' ? n.x : n.z })).sort((a, b) => a.t - b.t);
      r.nodesAlong = onRoad;
      for (let i = 0; i < onRoad.length - 1; i++) {
        const A = onRoad[i], B = onRoad[i + 1];
        const trimA = A.n.junction ? (r.axis === 'x' ? A.n.ex : A.n.ez) : 0;
        const trimB = B.n.junction ? (r.axis === 'x' ? B.n.ex : B.n.ez) : 0;
        const t0 = A.t + trimA, t1 = B.t - trimB;
        const len = t1 - t0;
        if (len < 0.3) continue;
        const mid = (t0 + t1) / 2;
        const { unit } = this._roadMat(r.lanes);
        const geo = new THREE.PlaneGeometry(r.width, len);
        geo.rotateX(-Math.PI / 2);
        const uv = geo.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * len / unit);
        if (r.axis === 'x') geo.rotateY(Math.PI / 2);
        const c = this._place(r, mid, 0, 0.03);
        geo.translate(c.x, c.y, c.z);
        if (!this.segmentGeos.has(r.lanes)) this.segmentGeos.set(r.lanes, { geos: [], infos: [] });
        const bucket = this.segmentGeos.get(r.lanes);
        bucket.geos.push(geo);
        bucket.infos.push(info, info); // two triangles per segment

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
            if (r.endMin !== 'bridge' && r.endMax !== 'bridge') {
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
      this.junctionPicks.push(n);
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
        if (n.signal) {
          const px = x + s.d[0] * ((alongX ? hcx : hcz) + bandDepth / 2) + right[0] * ((alongX ? hcz : hcx) + (alongX ? swz : swx) / 2);
          const pz = z + s.d[1] * ((alongX ? hcx : hcz) + bandDepth / 2) + right[1] * ((alongX ? hcz : hcx) + (alongX ? swz : swx) / 2);
          this.signals.push({ x: px, y: y + ch, z: pz, face: s.d, armOver: [-right[0], -right[1]], axis: alongX ? 'x' : 'z', reach: bandHalfLen * 0.7 });
        }
      }
    }
  }

  /** Street-name signs: a pole on two diagonal corners of every intersection with one blade per road. */
  _buildSigns() {
    const named = new Map();
    for (const r of this.roads) if (r.name && !named.has(r.name)) named.set(r.name, { name: r.name, nameEn: r.nameEn || '' });
    this.signAtlas = new SignAtlas([...named.values()]);
    const atlas = this.signAtlas;
    const pos = [], uv = [], nor = [];
    const faceInfos = [];
    const poles = [];
    const bladeW = 1.9, bladeH = 0.48;
    const quad = (cx, cy, cz, ax, az, slot, flip, info) => {
      // Quad spanning (ax, az) horizontally, facing the normal (az, -ax) (or the opposite when flipped).
      const hw = bladeW / 2, hh = bladeH / 2;
      const nx = flip ? az : -az, nz = flip ? -ax : ax;
      const sgn = flip ? -1 : 1;
      const p = (s, t) => [cx + ax * hw * s * sgn, cy + hh * t, cz + az * hw * s * sgn];
      const corners = [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)];
      const uvs = [[slot.u0, slot.v0], [slot.u1, slot.v0], [slot.u1, slot.v1], [slot.u0, slot.v1]];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        pos.push(...corners[k]); uv.push(...uvs[k]); nor.push(nx, 0, nz);
      }
      faceInfos.push(info, info);
    };
    const addPole = (x, y, z, names) => {
      poles.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + 1.75, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
      names.forEach(({ road, axis }, i) => {
        const slot = atlas.slots.get(road.name);
        const info = {
          id: `sign-${road.id}`, name: `${road.name} 路牌`, nameEn: `${road.nameEn} Street Sign`, category: '路牌 Street Sign',
          description: `路名牌：${road.name}（${road.nameEn}）。每个路口的对角各设一处双向路牌。`,
        };
        const ax = axis === 'x' ? 1 : 0, az = axis === 'x' ? 0 : 1;
        const off = (bladeW / 2 + 0.06);
        const cy = y + 3.25 - i * 0.6;
        const cx = x + ax * off, cz = z + az * off;
        quad(cx, cy, cz, ax, az, slot, false, info);
        quad(cx, cy, cz, ax, az, slot, true, info);
      });
    };
    for (const n of this.nodes) {
      if (!n.junction) continue;
      const xr = n.arms['+x'] || n.arms['-x'], zr = n.arms['+z'] || n.arms['-z'];
      const swx = n.ex - n.hcx, swz = n.ez - n.hcz;
      for (const [sx, sz] of [[1, -1], [-1, 1]]) {
        const px = n.x + sx * (n.hcx + swx * 0.55), pz = n.z + sz * (n.hcz + swz * 0.55);
        addPole(px, n.y + ROAD_STYLE.curbHeight, pz, [{ road: xr, axis: 'x' }, { road: zr, axis: 'z' }]);
      }
    }
    // Roads that never meet a junction still get one sign near their start.
    for (const r of this.roads) {
      if (r.connector || this.nodes.some((n) => n.junction && n.roads.has(r))) continue;
      const t = r.min + Math.min(14, (r.max - r.min) / 2);
      const p = this._place(r, t, r.width / 2 + ROAD_STYLE.sidewalk * 0.55, ROAD_STYLE.curbHeight);
      addPole(p.x, p.y, p.z, [{ road: r, axis: r.axis }]);
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const mat = new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.45, metalness: 0.1, emissive: 0xffffff, emissiveMap: atlas.texture, emissiveIntensity: 0 });
    this.ctx.nightMaterials.push({ material: mat, intensity: 0.22 });
    const blades = new THREE.Mesh(geo, mat);
    blades.castShadow = true;
    blades.userData.pick = faceInfos[0];
    blades.userData.pickResolver = (hit) => faceInfos[hit.faceIndex] || faceInfos[0];
    this.group.add(blades);
    this.ctx.pickables.push(blades);
    const poleMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.07, 3.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x8d949b, metalness: 0.7, roughness: 0.4 }), poles.length);
    poles.forEach((m, i) => poleMesh.setMatrixAt(i, m));
    poleMesh.castShadow = true;
    this.group.add(poleMesh);
  }

  _finalize() {
    const add = (geos, mat, shadow) => {
      if (!geos.length) return null;
      const m = new THREE.Mesh(mergeSimple(geos), mat);
      m.receiveShadow = true; m.castShadow = shadow;
      this.group.add(m);
      return m;
    };
    for (const [lanes, { geos, infos }] of this.segmentGeos) {
      const m = add(geos, this._roadMat(lanes).material, false);
      m.userData.pick = infos[0];
      m.userData.pickResolver = (hit) => infos[hit.faceIndex] || infos[0];
      this.ctx.pickables.push(m);
    }
    const sidewalks = add(this.sidewalkGeos, this.paverMat, true);
    if (sidewalks) {
      sidewalks.userData.pick = { id: 'sidewalks', name: '人行道', nameEn: 'Sidewalk', category: '道路 Road', description: '铺装人行道，路缘石高 16 厘米。' };
      this.ctx.pickables.push(sidewalks);
    }
    const asphalt = add(this.asphaltGeos, this.asphaltMat, false);
    if (asphalt) {
      const nodes = this.junctionPicks;
      const info = (n) => {
        const names = [...new Set([...n.roads].filter((r) => !r.connector).map((r) => r.name))];
        return { id: `junction-${n.x}-${n.z}`, name: names.length >= 2 ? `${names.join(' × ')} 路口` : '十字路口', nameEn: 'Intersection',
          category: '道路 Road', description: '带斑马线、停止线、交通信号灯与路名牌的路口。' };
      };
      asphalt.userData.pick = info(nodes[0]);
      asphalt.userData.pickResolver = (hit) => info(nodes[Math.floor(hit.faceIndex / 2)] || nodes[0]);
      this.ctx.pickables.push(asphalt);
    }
    add(this.markGeos, this.markMat, false);
  }
}
