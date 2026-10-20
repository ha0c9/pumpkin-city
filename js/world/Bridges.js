// Bridges between islands. Placement is found by marching across the terrain from a city road end.
import { BRIDGES, ROAD_STYLE } from '../config/city.layout.js';
import { roadTexture, paverTexture, concreteTexture } from '../core/Textures.js';
import { rodMatrix, instancedFrom, clamp } from '../core/Utils.js';

const THREE = window.THREE;

export class Bridge {
  constructor(cfg, terrain) {
    this.cfg = cfg;
    this.id = cfg.id;
    this.D = new THREE.Vector2(cfg.dir[0], cfg.dir[1]).normalize();
    this.R = new THREE.Vector2(-this.D.y, this.D.x);
    const F = new THREE.Vector2(cfg.from[0], cfg.from[1]);
    const startIsland = terrain.islandAt(F.x, F.y);
    const target = terrain.islandById(cfg.to);
    const hStart = terrain.heightAt(F.x, F.y);
    let tA = 0;
    for (let t = 0; t < 400; t += 0.5) {
      const x = F.x + this.D.x * t, z = F.y + this.D.y * t;
      if (terrain.heightAt(x, z) < hStart - 0.03) { tA = Math.max(0, t - 1.5); break; }
    }
    let tB = tA + 10;
    for (let t = tA + 5; t < 600; t += 0.5) {
      const x = F.x + this.D.x * t, z = F.y + this.D.y * t;
      const isl = terrain.islandAt(x, z);
      if (isl && isl.id === target.id && terrain.heightAt(x, z) >= target.height - 0.03) { tB = t + 1.5; break; }
    }
    this.start = F.clone();
    this.A = F.clone().addScaledVector(this.D, tA);
    this.B = F.clone().addScaledVector(this.D, tB);
    this.L = tB - tA;
    this.hA = terrain.heightAt(this.A.x, this.A.y);
    this.hB = terrain.heightAt(this.B.x, this.B.y);
    this.lanes = cfg.lanes || 2;
    this.carriage = this.lanes * ROAD_STYLE.laneWidth;
    this.walk = ROAD_STYLE.sidewalk;
    this.width = this.carriage + this.walk * 2;
    this.rise = { arch: 2.6, cable: 4.5, beam: 3.4 }[cfg.style] || 3;
    this.fromIsland = startIsland;
    this.toIsland = target;
  }

  deckY(s) {
    const k = Math.sin(Math.PI * clamp(s, 0, 1));
    return this.hA + (this.hB - this.hA) * s + this.rise * k * k;
  }

  point(s, r, yOff = 0, out = new THREE.Vector3()) {
    const x = this.A.x + this.D.x * this.L * s + this.R.x * r;
    const z = this.A.y + this.D.y * this.L * s + this.R.y * r;
    return out.set(x, this.deckY(s) + yOff, z);
  }

  /** Deck height at (x, z) or null when outside the deck. */
  heightAt(x, z) {
    const dx = x - this.A.x, dz = z - this.A.y;
    const along = dx * this.D.x + dz * this.D.y;
    const across = dx * this.R.x + dz * this.R.y;
    if (along < 0 || along > this.L || Math.abs(across) > this.width / 2) return null;
    return this.deckY(along / this.L) + (Math.abs(across) > this.carriage / 2 ? 0.2 : 0.03);
  }
}

/** Ribbon swept along the bridge. profile: [[r, y], ...] cross-section polyline. */
function sweep(bridge, profile, { segments, uvMode = 'world', unit = 1, s0 = 0, s1 = 1 }) {
  const pos = [], uv = [], idx = [];
  const cols = profile.length;
  const crossLen = [0];
  for (let i = 1; i < cols; i++) {
    const a = profile[i - 1], b = profile[i];
    crossLen.push(crossLen[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const p = new THREE.Vector3();
  for (let j = 0; j <= segments; j++) {
    const s = s0 + (s1 - s0) * j / segments;
    const along = s * bridge.L;
    for (let i = 0; i < cols; i++) {
      bridge.point(s, profile[i][0], profile[i][1], p);
      pos.push(p.x, p.y, p.z);
      if (uvMode === 'road') uv.push(i / (cols - 1), along / unit);
      else uv.push(crossLen[i] / unit, along / unit);
    }
  }
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Bridges {
  constructor(ctx, terrain) {
    this.ctx = ctx;
    this.items = BRIDGES.map((cfg) => new Bridge(cfg, terrain));
    this.lamps = [];
    this.group = new THREE.Group();
    this.group.name = 'bridges';
    ctx.scene.add(this.group);

    this.mats = {
      concrete: new THREE.MeshStandardMaterial({ map: concreteTexture(), color: 0xd8d4cc, roughness: 0.85 }),
      paver: new THREE.MeshStandardMaterial({ map: paverTexture(), roughness: 0.8 }),
      steelWhite: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.35, metalness: 0.6 }),
      steelRed: new THREE.MeshStandardMaterial({ color: 0xc8432b, roughness: 0.4, metalness: 0.5 }),
      cable: new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.3, metalness: 0.8 }),
      rail: new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide }),
    };
    this.unitCyl = new THREE.CylinderGeometry(1, 1, 1, 10);
    this.unitBox = new THREE.BoxGeometry(1, 1, 1);
    for (const b of this.items) this._build(b, terrain);
  }

  /** Extra road segments that connect the city grid and far islands to the bridge decks. */
  connectorRoads() {
    const roads = [];
    for (const b of this.items) {
      if (b.A.distanceTo(b.start) > 0.5) {
        roads.push({ id: `${b.id}-approach`, name: b.cfg.name + '引道', nameEn: b.cfg.nameEn + ' Approach',
          from: [b.start.x, b.start.y], to: [b.A.x, b.A.y], lanes: b.lanes, endA: 'node', endB: 'bridge' });
      }
      const end = b.B.clone().addScaledVector(b.D, 18);
      roads.push({ id: `${b.id}-landing`, name: b.toIsland.name + '入口', nameEn: b.toIsland.nameEn + ' Entrance',
        from: [b.B.x, b.B.y], to: [end.x, end.y], lanes: b.lanes, endA: 'bridge', endB: 'deadend' });
    }
    return roads;
  }

  heightAt(x, z) {
    let best = null;
    for (const b of this.items) {
      const h = b.heightAt(x, z);
      if (h !== null && (best === null || h > best)) best = h;
    }
    return best;
  }

  _build(b, terrain) {
    const g = new THREE.Group();
    g.name = b.id;
    const segs = Math.max(16, Math.ceil(b.L / 2));
    const hc = b.carriage / 2, hw = b.width / 2;
    const thick = b.cfg.style === 'beam' ? 1.8 : 1.1;
    const rt = roadTexture(b.lanes, ROAD_STYLE.laneWidth);
    const roadMat = new THREE.MeshStandardMaterial({ map: rt.texture, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1 });
    this.ctx.wetMaterials.push({ material: roadMat, dry: 0.85, wet: 0.22 });

    const add = (geo, mat, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = shadow; m.receiveShadow = true;
      g.add(m);
      return m;
    };
    add(sweep(b, [[-hc, 0.03], [hc, 0.03]], { segments: segs, uvMode: 'road', unit: rt.unit }), roadMat, false);
    for (const side of [-1, 1]) {
      const walk = side < 0 ? [[-hw, 0.2], [-hc, 0.2]] : [[hc, 0.2], [hw, 0.2]];
      add(sweep(b, walk, { segments: segs, unit: 2 }), this.mats.paver, false);
      const curb = side < 0 ? [[-hc, 0.2], [-hc, 0.03]] : [[hc, 0.03], [hc, 0.2]];
      add(sweep(b, curb, { segments: segs, unit: 2 }), this.mats.concrete, false);
    }
    add(sweep(b, [[hw, 0.2], [hw, -thick], [-hw, -thick], [-hw, 0.2]], { segments: segs, unit: 3 }), this.mats.concrete);

    // Railings: posts + top rail on both edges.
    const posts = [];
    const p1 = new THREE.Vector3(), p2 = new THREE.Vector3();
    const postCount = Math.floor(b.L / 2);
    for (const side of [-1, 1]) {
      const r = side * (hw - 0.12);
      for (let i = 0; i <= postCount; i++) {
        const s = i / postCount;
        b.point(s, r, 0.2, p1); b.point(s, r, 1.25, p2);
        posts.push(rodMatrix(p1, p2, 0.045));
      }
      add(sweep(b, [[r - 0.06, 1.25], [r + 0.06, 1.25]], { segments: segs }), this.mats.rail, false);
      add(sweep(b, [[r, 1.25], [r, 1.17]], { segments: segs }), this.mats.rail, false);
      add(sweep(b, [[r, 0.7], [r, 0.65]], { segments: segs }), this.mats.rail, false);
    }
    g.add(instancedFrom(this.unitCyl, this.mats.rail, posts, { castShadow: false }));

    // Lamps along both walkways, staggered.
    const lampN = Math.max(2, Math.round(b.L / 16));
    for (let i = 0; i <= lampN; i++) {
      const s = i / lampN;
      const side = i % 2 === 0 ? 1 : -1;
      const p = b.point(s, side * (hw - 0.45), 0.2);
      this.lamps.push({ x: p.x, y: p.y, z: p.z, dirX: -side * b.R.x, dirZ: -side * b.R.y });
    }

    // Structural style.
    const rods = { concrete: [], steel: [], cable: [] };
    const seabedAt = (p) => terrain.heightAt(p.x, p.z) - 1;
    const pier = (s) => {
      const top = b.deckY(s) - thick;
      for (const side of [-1, 1]) {
        const p = b.point(s, side * (hw - 1.6), 0);
        p.y = top;
        const bottom = new THREE.Vector3(p.x, seabedAt(p), p.z);
        if (bottom.y < top) rods.concrete.push(rodMatrix(bottom, p, 0.85));
      }
      const capA = b.point(s, -hw + 0.6, -thick - 0.5), capB = b.point(s, hw - 0.6, -thick - 0.5);
      const cap = new THREE.Mesh(this.unitBox, this.mats.concrete);
      cap.position.addVectors(capA, capB).multiplyScalar(0.5);
      cap.scale.set(b.width - 1, 1, 2.2);
      cap.rotation.y = Math.atan2(b.D.x, b.D.y);
      cap.castShadow = true;
      g.add(cap);
    };

    if (b.cfg.style === 'beam') {
      const n = Math.max(2, Math.round(b.L / 18));
      for (let i = 1; i < n; i++) pier(i / n);
    } else if (b.cfg.style === 'arch') {
      pier(0.08); pier(0.92);
      const archH = Math.min(16, b.L * 0.22);
      const curves = [];
      for (const side of [-1, 1]) {
        const pts = [];
        for (let i = 0; i <= 40; i++) {
          const s = 0.04 + 0.92 * i / 40;
          const base = b.deckY(0.04) + (b.deckY(0.96) - b.deckY(0.04)) * (i / 40);
          const pp = b.point(s, side * (hw + 0.35), 0);
          pp.y = base + 0.2 + archH * Math.sin(Math.PI * i / 40);
          pts.push(pp);
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        curves.push(curve);
        add(new THREE.TubeGeometry(curve, 64, 0.42, 10, false), this.mats.steelWhite);
        const hangers = Math.round(b.L / 3.5);
        for (let i = 1; i < hangers; i++) {
          const t = i / hangers;
          const top = curve.getPointAt(t);
          const s = 0.04 + 0.92 * t;
          const bottom = b.point(s, side * (hw + 0.35), 0.1);
          if (top.y - bottom.y > 0.8) rods.steel.push(rodMatrix(bottom, top, 0.06));
        }
      }
      for (const t of [0.3, 0.42, 0.5, 0.58, 0.7]) {
        rods.steel.push(rodMatrix(curves[0].getPointAt(t), curves[1].getPointAt(t), 0.22));
      }
      for (const side of [-1, 1]) {
        rods.steel.push(rodMatrix(b.point(0.04, side * (hw + 0.35), -thick), b.point(0.96, side * (hw + 0.35), -thick), 0.3));
      }
    } else if (b.cfg.style === 'cable') {
      const sP = 0.5;
      const pylonTop = b.deckY(sP) + 30;
      for (const side of [-1, 1]) {
        const base = b.point(sP, side * (hw + 1.4), 0);
        base.y = seabedAt(base);
        const top = b.point(sP, side * 0.9, 0);
        top.y = pylonTop;
        rods.concrete.push(rodMatrix(base, top, 1.0));
      }
      const beam = (y, r) => {
        const a = b.point(sP, -r, 0); a.y = y;
        const c = b.point(sP, r, 0); c.y = y;
        rods.concrete.push(rodMatrix(a, c, 0.7));
      };
      beam(b.deckY(sP) - thick - 0.6, hw + 1.2);
      beam(pylonTop - 9, 2.4);
      const anchors = 9;
      for (let k = 1; k <= anchors; k++) {
        for (const dirS of [-1, 1]) {
          const s = sP + dirS * 0.47 * k / anchors;
          for (const side of [-1, 1]) {
            const deck = b.point(s, side * (hw + 0.15), 0.2);
            const anchor = b.point(sP, side * 1.2, 0);
            anchor.y = pylonTop - 1.5 - (anchors - k) * 1.3;
            rods.cable.push(rodMatrix(deck, anchor, 0.07));
          }
        }
      }
      pier(0.12); pier(0.88);
      const warning = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2200, emissiveIntensity: 0 }));
      warning.position.copy(b.point(sP, 0, 0)); warning.position.y = pylonTop + 0.4;
      g.add(warning);
      this.ctx.nightMaterials.push({ material: warning.material, intensity: 3, blink: true });
    }
    // Abutments.
    for (const s of [0, 1]) {
      const p = b.point(s, 0, 0);
      const ab = new THREE.Mesh(this.unitBox, this.mats.concrete);
      ab.scale.set(b.width + 0.6, 6, 3);
      ab.position.set(p.x, p.y - thick - 2.6, p.z);
      ab.rotation.y = Math.atan2(b.D.x, b.D.y);
      g.add(ab);
    }

    if (rods.concrete.length) g.add(instancedFrom(this.unitCyl, this.mats.concrete, rods.concrete));
    if (rods.steel.length) g.add(instancedFrom(this.unitCyl, b.cfg.style === 'arch' ? this.mats.steelWhite : this.mats.steelRed, rods.steel));
    if (rods.cable.length) g.add(instancedFrom(this.unitCyl, this.mats.cable, rods.cable, { castShadow: false }));

    const info = {
      id: b.id, name: b.cfg.name, nameEn: b.cfg.nameEn, category: '桥梁 Bridge',
      description: `连接${b.fromIsland ? b.fromIsland.name : ''}与${b.toIsland.name}，全长约 ${Math.round(b.L)} 米，${b.lanes} 车道，双侧人行道。`,
    };
    g.traverse((o) => { o.userData.pick = info; });
    const mid = b.point(0.5, 0, 0);
    info.focus = [mid.x, mid.y, mid.z];
    info.radius = b.L * 0.6;
    this.ctx.pickables.push(g);
    this.ctx.mask.addRect((b.A.x + b.B.x) / 2, (b.A.y + b.B.y) / 2,
      Math.abs(b.D.x) > 0.5 ? b.L + 4 : b.width + 2, Math.abs(b.D.x) > 0.5 ? b.width + 2 : b.L + 4, 0, 'bridge');
    this.group.add(g);
    b.group = g;
  }
}
